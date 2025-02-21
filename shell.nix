{ pkgs ? import <nixpkgs> {} }:
  pkgs.mkShell {
    # nativeBuildInputs is usually what you want -- tools you need to run
    nativeBuildInputs = with pkgs; [
      nodejs_20
      curl
      zellij # smart terminal workspace
      lazygit # git terminal
      just # task runner
      fzf # fuzzy finder, for "just watch"
    ];
}

