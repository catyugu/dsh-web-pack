import { createRequire as __dshCreateRequire } from 'node:module';
const require = __dshCreateRequire(import.meta.url);

// packages/dsh-remote-web/src/invariant.ts
var PACKAGE_NAME = "@catyugu/dsh-remote-web";
var name = "remote-web-invariant";
var inject = ["invariants"];
var install = () => {
};
var apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
export {
  apply,
  inject,
  name
};
