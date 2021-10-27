import "./FileTree.js";
import "./monaco.js";
import "./sdp-nav/sdp-nav.js";
import mixpanel from "mixpanel-browser";

mixpanel.init("ef2707833d892d15d0d6b833bb664223", {
  ignore_dnt: true,
  disable_persistence: true,
});
mixpanel.track("Page View");
