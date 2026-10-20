# Rebuilding the Windows libvips bundle

Recipe, as documented by the upstream projects (`libvips/build-win64-mxe` v8.18.7 `README.md` and
`build.sh`, `lovell/sharp-libvips` v1.3.4 `build/win.sh`; both are in the source archive):

1. Extract `build-win64-mxe-v8.18.7.tar.gz` and run, with Docker or Podman available:

   ```sh
   ./build.sh --with-ffi-compat -t x86_64-w64-mingw32.static vips-web
   ```

   The script builds a container from `container/base.Dockerfile` (the MXE fork in
   `mxe-llvm-mingw-*.tar.gz`; `--without-prebuilt` forces this instead of pulling the project's published
   base image), cross-compiles the `vips-web` dependency set and writes the zip under `build/`.
2. To change libvips, add a patch named `build/patches/vips-<n>-<name>.patch` before step 1 (the recipe
   `build/vips.mk` applies every `vips-[0-9]*.patch`).
3. Take `vips-dev-8.18/bin/libvips-42.dll` from the resulting zip and put it into
   `resources/app.asar.unpacked/node_modules/@img/sharp-win32-x64/lib/` of the installed application,
   replacing the existing file.

Whether these exact options reproduce the distributed DLL byte for byte is not established: the DLL
shipped in `@img/sharp-win32-x64` is byte-identical to `vips-dev-x64-web-8.18.7-static.zip` published by
`libvips/build-win64-mxe`, whose build options are not recorded in the recipe repository.

Status of the test: this procedure has not yet been run in this project; see `legal/NATIVE-COMPONENTS.md`.
