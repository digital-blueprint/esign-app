{
  pkgs ? import <nixpkgs> { },
}:
let
  projectName = "esign";
  config = import ./vendor/toolkit/shared { inherit pkgs projectName; };
in
pkgs.mkShell {
  nativeBuildInputs =
    config.nativeBuildInputs
    ++ (with pkgs; [
    ]);

  shellHook = config.shellHook + '''';
}
