"use strict";
const { NativeEsmTestLoader } = require("./native_esm_test_loader");
// Public fixture name retained; live checks evaluate authored ESM without transport.
class StageThreeCompatibilityTestLoader extends NativeEsmTestLoader {}
module.exports={StageThreeCompatibilityTestLoader};
