# @proofkit/better-auth

## 0.4.0-beta.16

### Patch Changes

- Updated dependencies [638f432]
  - @proofkit/fmodata@0.1.0-beta.40

## 0.4.0-beta.15

### Patch Changes

- Updated dependencies [2f0f8f3]
- Updated dependencies [3d8cd82]
- Updated dependencies [7906ee8]
- Updated dependencies [c0ab6fd]
- Updated dependencies [ac7c9f4]
  - @proofkit/fmodata@0.1.0-beta.39

## 0.4.0-beta.14

### Patch Changes

- Updated dependencies [b075656]
  - @proofkit/fmodata@0.1.0-beta.38

## 0.4.0-beta.13

### Patch Changes

- Updated dependencies [e6889d0]
  - @proofkit/fmodata@0.1.0-beta.37

## 0.4.0-beta.12

### Patch Changes

- Updated dependencies [e0a9443]
  - @proofkit/fmodata@0.1.0-beta.36

## 0.4.0-beta.11

### Patch Changes

- Updated dependencies [b73b0d7]
  - @proofkit/fmodata@0.1.0-beta.35

## 0.4.0-beta.10

### Patch Changes

- Updated dependencies [ce73357]
  - @proofkit/fmodata@0.1.0-beta.34

## 0.4.0-beta.9

### Patch Changes

- Updated dependencies [5544f68]
- Updated dependencies [f3980b1]
  - @proofkit/fmodata@0.1.0-beta.33

## 0.4.0-beta.8

### Patch Changes

- Updated dependencies [78a9f70]
- Updated dependencies [de21bbe]
- Updated dependencies [1acca57]
  - @proofkit/fmodata@0.1.0-beta.32

## 0.4.0-beta.7

### Minor Changes

- 2cddedf: Fix `getMetadata()` key lookup when FileMaker Server returns the database name without `.fmp12` extension. Upgrade better-auth to 1.5.x (`createAdapter` → `createAdapterFactory`, removed `getAdapter`).

### Patch Changes

- Updated dependencies [2cddedf]
- Updated dependencies [c5efdbd]
  - @proofkit/fmodata@0.1.0-beta.31

## 0.4.0-beta.6

### Patch Changes

- Updated dependencies
  - @proofkit/fmodata@0.1.0-beta.29

## 0.4.0-beta.5

### Patch Changes

- Updated dependencies [6c6b569]
  - @proofkit/fmodata@0.1.0-beta.28

## 0.4.0-beta.4

### Patch Changes

- Updated dependencies [840c7c1]
  - @proofkit/fmodata@0.1.0-beta.27

## 0.4.0-beta.3

### Patch Changes

- Updated dependencies [553d386]
  - @proofkit/fmodata@0.1.0-beta.26

## 0.4.0-beta.2

### Minor Changes

- 69fd3fb: BREAKING(@proofkit/better-auth): Use fmodata Database object instead of raw OData config.
  Config now requires `database` (fmodata Database instance) instead of
  `odata: { serverUrl, auth, database }`.
  Enables fetch override via FMServerConnection's fetchClientOptions.

### Patch Changes

- Updated dependencies [69fd3fb]
  - @proofkit/fmodata@0.1.0-beta.25

## 0.3.1-beta.1

### Patch Changes

- 2858f6a: Fix TypeScript build errors by making adapter/migration types resilient to upstream Better Auth changes.

## 0.3.1-beta.0

### Patch Changes

- 863e1e8: Update tooling to Biome

## 0.3.0

### Minor Changes

- 10f3fc4: Change underlying fetch implementation

## 0.2.4

### Patch Changes

- Auto load env vars in migrate CLI

## 0.2.3

### Patch Changes

- update types

## 0.2.2

### Patch Changes

- update migration field types

## 0.2.1

### Patch Changes

- Add debug logging
- Fix date parsing in odata filter query

## 0.2.0

### Minor Changes

- Make raw odata requests

## 0.2.0-beta.0

### Minor Changes

- Make raw odata requests
