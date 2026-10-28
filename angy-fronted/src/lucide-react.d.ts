// lucide-react@1.59.0 ships a `typings` field that points at a file missing
// from the published tarball. A bare module declaration keeps `tsc` honest
// about our own code without pretending we can type a third-party package that
// does not ship its types. Remove this if the dependency starts publishing them.
declare module "lucide-react";
