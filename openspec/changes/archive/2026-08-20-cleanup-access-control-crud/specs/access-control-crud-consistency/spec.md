## ADDED Requirements

### Requirement: Access-control mapper files follow the singular `<name>.mapper.ts` convention
`permissions` and `roles` SHALL each expose their mapper from a file named `<name>.mapper.ts` (singular, no typo), matching the filename convention used by every other module in `src/modules/`.

#### Scenario: Mapper filenames match convention
- **WHEN** inspecting `src/modules/permissions/` and `src/modules/roles/`
- **THEN** the mapper file is named `permission.mapper.ts` and `role.mapper.ts` respectively, and no file named `permisison.mapper.ts` or `role.mappers.ts` remains

### Requirement: role-permissions responses are produced via a mapper layer
`role-permissions` SHALL query Prisma using an `include` const defined in `role-permissions.types.ts`, and SHALL return responses through `role-permissions.mapper.ts` (`RolePermissionMapper.toDto`) instead of duplicated inline `.map(...)` logic.

#### Scenario: Assign and list use the same mapper
- **WHEN** `POST /roles/:id/permissions` (assign) and `GET /roles/:id/permissions` (list) are both called
- **THEN** both responses are produced by the same `RolePermissionMapper.toDto` call, with identical field names/types to the pre-refactor inline mapping

### Requirement: Existing role/permission CRUD behavior is preserved
`permissions`, `roles`, and `role-permissions` endpoints SHALL continue to behave identically to their pre-refactor behavior after the filename/mapper cleanup.

#### Scenario: Role-permission assignment round-trip is unaffected
- **WHEN** a client assigns permissions to a role, lists them, then removes one
- **THEN** every response has the same status code and fields as before this change

#### Scenario: Application still boots
- **WHEN** the application is started after this change is applied
- **THEN** `pnpm run build` succeeds with no unresolved imports from the renamed files, and the Nest application boots without DI errors
