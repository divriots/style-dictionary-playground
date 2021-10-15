# NodeJS in the Browser

A common pattern in the NodeJS ecosystem is having browser playgrounds or REPL (read-eval-print loop) to provide an interactive programming environment for tools.

The main challenge? Making the tool work in the browser.

This allows you to simply share a URL and let people play with your tools & products, without any development setup required.
This is important to reeling in those users and convince them that your thing is awesome.

[Backlight](https://backlight.dev/) is an example of a browser IDE, and in order to support NodeJS libraries, compilers, tools, it is preferable that they work in the browser so that we can leverage the browser of the client to do all the work. Not only is this often a better experience for the client, it also prevents needing to outsource things server-side and thus increasing costs on your end.

In this blog we will look at a library called [Style Dictionary](https://amzn.github.io/style-dictionary/), and creating a [browser playground](https://style-dictionary-play.dev) for it. 

[Playground Github Repo](https://github.com/divriots/style-dictionary-playground)

## Style Dictionary

Amazon created [Style Dictionary](https://amzn.github.io/style-dictionary/) and their page has a pretty good description of the tool.

> Style Dictionary is a build system that allows you to define styles once, in a way for any platform or language to consume. A single place to create and edit your styles, and a single command exports these rules to all the places you need them - iOS, Android, CSS, JS, HTML, sketch files, style documentation, or anything you can think of. It is available as a CLI through npm, but can also be used like any normal node module if you want to extend its functionality.

For example, you may have a color tokens file:

```json
{
  "color": {
    "base": {
      "gray": {
        "light": {
          "value": "#CCCCCC"
        },
        "medium": {
          "value": "#999999"
        },
        "dark": {
          "value": "#111111"
        }
      },
      "red": {
        "value": "#FF0000"
      },
      "green": {
        "value": "#00FF00"
      }
    }
  }
}
```

That's great, but in order to consume those tokens in UI components, you want to export that to iOS `.swift` file, or an Android `.xml` file, or as CSS custom properties or JS variables for the web.
Style Dictionary allows you to do this easily with a great API to create your own export formats (through `transforms`/`transformGroups`).

You can do this in essentially two ways:

- Use the CLI
- Use Node API

However, we need a third way:

- Browser API

This means the tool needs to work in the browser and used NodeJS internals need to be shimmed or replaced. Furthermore, the JS needs to be formatted to something that is not CommonJS, as it does not work in browsers out of the box. ES Modules would be the modern format, or we can use older formats like IIFE or SystemJS that are also pretty common, especially if IE11 needs to be supported.

## Browserify

In comes [browserify](https://browserify.org/). Essentially, browserify lets you use CommonJS in the browser by bundling up your dependencies, so there's no more `require()` and `module.exports`. This is essentially what other bundlers like [rollup](https://rollupjs.org/) and [webpack](https://webpack.js.org/) do, but browserify is catered more towards making Node packages usable in the browser.

How is it catered to browsers? It replaces calls to built-in modules like `path`, as well as globals like `Buffer` and `process`, to shims that work in the browser. These are essentially (sometimes slightly "naive") browser-alternatives to those NodeJS internals. Browserify already brings a lot of these out of the box, which is super neat.

If you need to add more however, you can. For example, `style-dictionary` uses `fs`, which is the NodeJS builtin module for interacting with the filesystem. Browsers don't have a filesystem which you can access by JavaScript. There's a few alternatives though.

Another example is `memfs` which does the same thing but instead of using IndexedDB, it stores the file data in memory. Memory means it gets garbage collected and is not persistent, but a big pro of `memfs` is that, contrary to `browserify-fs`, it supports way more `fs` methods, including synchronous methods. `browserify-fs` is both really old and unmaintained, and it's also quite tricky to support sync methods when IndexedDB is asynchronous by nature, where memory can do both.

### browserify-fs & IndexedDB

IndexedDB is a file-like database that browsers can use, and there's a package called `browserify-fs` that creates an interface with IndexedDB while using `fs` methods.

So what you get is essentially that a call like this:

```js
fs.writeFile('customers', data, (err) => {
  //
});
```

Uses something like this under the hood:

```js
const transaction = db.transaction(["customers"], "readwrite");
const objectStore = transaction.objectStore("customers");
const request = objectStore.add('Bob');
request.onsuccess = (event) => {
  // success!
}
```

Advantage of using IndexedDB:

- Persistent storage, works between page refreshes
- Meant for file-storage, up to 1 GB for Safari, with even larger for other browsers
- Database-like interface

What's not so great about `browserify-fs` is that it mimicks a pretty old version of NodeJS, so things like mkdir `recursive` option is not possible, although you can make your own if you want. It also doesn't support sync `fs` methods, since IndexedDB is asynchronous by nature. Lastly, it reuses the same IndexedDB, meaning that if you have multiple tabs open, they'll be targeting the same IndexedDB instance which is annoying. My solution for that was patching `browserify-fs` to mark the databases with timestamps so they're unique. Then, to make sure I don't fill up people's browsers with IndexedDB data, I run a cleanup utility that clears any old database if the amount of databases goes beyond a certain amount. So you're in charge of garbage collection now.

## memfs

The other approach is to store the files in memory. Imagine an object where folders/files are the keys, folders have nested objects, and files have string values with the file content. Pretty straightforward right?
Fortunately, `memfs` is such a solution.
It's way more up to date meaning you can use modern fs methods too.
Since files are stored in memory, you can use synchronous `fs` methods too!

For our playground I am opting for `memfs` as it is more developer friendly for our use case.

## Patching Style Dictionary

In order for style-dictionary to work in the browser, we had to disable or patch a few parts of the library.

### fs calls

Since a browser shim for file-system will be used, we need to think about what fs methods are supported for such shims.

If you use `memfs` you can use both sync and async methods, but if you use `browserify-fs` which uses IndexedDB, you can only use asynchronous methods, and it relies on a pretty old version of NodeJS so recently added methods aren't available.

Since for now I want to support both and allow the user to choose, we patched some of the fs calls.
That said, the patch would be a lot smaller without this requirement, making the fork more closely aligned with the origin and `browserify-fs` is not maintained anymore, so I may opt to force the `memfs` option in the future.

```js
fs.writeFileSync(pathToFile, fileData);
// code after file write is complete
```

becomes:

```js
await new Promise((resolve) => {
  fs.writeFile(pathToFile, fileData, resolve);
});
// code after file write is complete
```

The same goes for `require` calls used to load JSON content, they also need to be replaced by something the browser fs shim will be able to use.

```js
file_content = require(pathToFile);
// do something with JSON content
```

becomes

```js
file_content = await new Promise((resolve) => {
  fs.readFile(pathToFile, { encoding: 'UTF-8' }, (err, data) => {
    resolve(JSON.parse(data));
  });
});
// do something with JSON content
```

There was also a recursive `mkdir` method being used from `fs-extra`.
That call can generally be replaced by `fs.mkdir(path, { recursive: true })`, but since some browser FS shims rely on older versions of NodeJS where this option was not available, I created a [small async utility](https://github.com/jorenbroekema/style-dictionary/blob/main/lib/utils/mkdirRecursive.js) for it.

### Disabling features

Sadly, there are some features for which it was hard to think of a browser replacement on the spot, or they were not crucial to the experience in browsers:

- Actions, to run custom build code such as generating binary assets like images. Not a clear way at the moment to store such files and display them properly in browser env, so left this out for now, although I see opportunities to make it work.
- registerTemplate. At the moment, [we advise users to add a bundle step](https://www.npmjs.com/package/browser-style-dictionary#browser) to replace `fs` calls to read out templates in style-dictionary with the contents of those tempates, which for rollup looks like this:
  ```js
  {
    name: "inline-fs",
    transform(code, id) {
      return code.replace(
        /fs.readFileSync\(\s*__dirname\s*\+\s*'\/templates\/(.*)'\)/g,
        (match, $1) => {
          const tpl = path.join(
            "./node_modules/browser-style-dictionary/lib/common/templates",
            $1
          );
          return JSON.stringify(fs.readFileSync(tpl, "utf8"));
        }
      );
    },
  },
  ```
  We could potentially use a different strategy there, raise an issue if you've got ideas!
- cleanPlatform / cleanAllPlatforms. This can probably be re-enabled by patching the `fs` calls, I just didn't really get to that as I didn't have a use case to try it out with.
- [json5](https://www.npmjs.com/package/json5) support. I disabled it for the time being, however `json5` works in browsers through a global if you load it, so we could patch `JSON` calls to `JSON5` calls for that to work in browser style-dictionary.

Contributions are very welcome for re-enabling these features!

> If Danny Banks or someone else from the style-dictionary team is reading this, if we can find a solution for these 4 things,
> it would be way better if we can upstream this so we no longer need a fork that inevitably will go out of sync.
> I'm open to forcing `memfs` as the fs shim, meaning fs calls can be reverted to their old state (using sync methods).

## Monaco

At first, the only thing I had working were console statements that gave me the impression my browser-patch was working in the browser.

That's not an attractive way to sell it, making a playground will show the strengths of making it work in the browser.

It's pretty clear that most people seem to prefer the [VSCode](https://code.visualstudio.com/) editor,
which is called [Monaco editor](https://microsoft.github.io/monaco-editor/),
so I opted for this over [CodeMirror](https://codemirror.net/) or other alternatives.

While I am super grateful that they open sourced their editor for others to use, for the sake of transparency I do feel the urge to explain some of the developer experience grievances I have with it:

- While the API Reference docs are good, there's no guides/tutorials that explain how to do common things like:
  - Changing the language of the current editor
  - Loading the editor with the proper dimensions, and make it responsive
- The editor uses codicons, but no explanation on how to ensure they get loaded properly.
- If you integrate the ESM version with bundler, your page will be slow to load.
- The AMD version through a CDN is faster, but took a lot of effort to make it work with the monaco workers, this part is not documented although you can find it in their Github Issues.
- Your container needs fixed height/width or your editor will have 5px height. This feels a little weird to me.

Once it works, it is super awesome. Feel free to take inspiration from [how I ended up implementing this](https://github.com/divriots/style-dictionary-playground/blob/main/src/browser/monaco.js). It sets a few globals that you can then use in your NodeJS based code as well, as I bundle "real browser" and "browserified nodejs" code separately.

## File-tree utils

Monaco editor is just the editor part, it doesn't come with file tree utilities.

You can try using their Tree components, but documentation is completely absent and you'll need to hack it in place by skimming through their source code and figuring out what the hooks are that you need to listen to.
After a few hours of doing that, I threw in the towel and created my own file tree utility with `details` and `summary` elements. That took more time than I imagined and it isn't the same quality as the VS Code file tree, but it works well enough for my intents and purposes.

A few advantages of making my own file tree:

- Easily split output files from input files, making it easier to navigate the style-dictionary playground
- Pick your own file icon theme. I use [material-icon-theme](https://www.npmjs.com/package/material-icon-theme)
- Dispatch custom events, providing your own hooks, making it easy to control the editor when the user interacts with the file tree

## Encode in URL

One very cool feature I saw in playgrounds like [lit playground](https://lit.dev/playground/) is that they encode the contents of the editor in the URL when the user edits.
This makes it very easy to share your current playground session without needing a backend + database to store it, since all the relevant data is in the URL itself.

Lit uses base64 encoding from the looks of it. Since the style-dictionary playground can have many input files, I am a bit concerned about hitting the URL cap, so I took some effort to find a way to compress the data.

Since browsers can use WebAssembly, which is great for processes like compressing data, we can use `wasm-flate`:

```html
<script src="https://unpkg.com/wasm-flate@0.1.11-alpha/dist/bootstrap.js"></script>
```

This allows you to compress and decompress the data:

```js
flate.deflate_encode(content)
```

Fortunately, this cut the length of the string almost in half!
Then, when the page is loaded with a URL query paramater containing the contents, it will decode it and load the files in the editor.

## Conclusion

So with these ingredients:

- browser-patch of style-dictionary + browserify bundle step with fs shim
- monaco-editor
- file-tree
- encoded URL

we have our [style-dictionary playground](https://style-dictionary-play.dev), a showcase of a NodeJS library working in the browser.

The fun part of this whole process is that you can swap out style-dictionary with other NodeJS libraries and do the same thing for those.
Of course, not every NodeJS library is going to be as easy to browserify; for some you will need to patch them and provide your own shims and for some it may prove infeasible.

Hopefully you feel inspired to make your favorite NodeJS lib work in the browser and perhaps you too can contribute playgrounds for tools to the community like we did with style-dictionary.
