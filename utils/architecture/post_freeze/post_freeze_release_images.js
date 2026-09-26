"use strict";

const { PostFreezeReleaseTransition } = require("./post_freeze_release_transition");

// After the v0.24.59 release, restores the release before-images so the Stage 3.22 review replays
// at its recorded checkpoint. Before the release there is nothing to restore.
class PostFreezeReleaseImages {
  static load(root) {
    const transition = new PostFreezeReleaseTransition(root);
    if (!transition.exists()) return null;
    transition.artifact();
    return { beforeImage: (file, bytes) => transition.before(file, bytes) };
  }
}

module.exports = { PostFreezeReleaseImages };
