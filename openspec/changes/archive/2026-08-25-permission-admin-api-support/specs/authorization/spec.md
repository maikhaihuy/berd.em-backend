## MODIFIED Requirements

### Requirement: Unresolvable `$self` token denies the request

The system SHALL, when a matched grant's `condition` requires substituting
`$self` for an identifier the caller does not have (e.g. a condition keyed
on `employeeId` for a caller with no linked `Employee`), or when a
`condition` contains a token the system does not recognize at all, log a
warning and exclude that one rule from the built `Ability` — never throw,
and never build an `Ability` rule with an unsatisfiable or silently-empty
condition. The request as a whole is denied only if, after dropping any
unresolvable rules, no surviving rule satisfies the route's required
`(action, subject)` — the same outcome as if the caller simply held one
fewer grant, not a guaranteed deny triggered directly by the bad condition.

#### Scenario: User with no employee record hits an employee-scoped route, with no other grant

- **GIVEN** a caller whose `AuthenticatedUserDto.employeeId` is undefined
- **WHEN** the caller's only matching grant for the route carries
  `condition: { "employeeId": "$self" }`
- **THEN** that rule is dropped (with a logged warning) and the caller has
  no surviving rule for the route, so the system responds `403 Forbidden` —
  the same end result as before, but reached because no rule remains, not
  because resolution itself throws.

#### Scenario: A caller with one unresolvable grant and one valid grant is still authorized

- **GIVEN** a caller whose `AuthenticatedUserDto.employeeId` is undefined,
  holding two grants for the same route's required `(action, subject)`: one
  with `condition: { "employeeId": "$self" }` (unresolvable) and one with no
  condition
- **WHEN** the caller calls the route
- **THEN** the unresolvable grant is dropped (with a logged warning) and the
  request is authorized via the unconditioned grant — the route is not
  denied just because one of the caller's several grants happened to be
  unresolvable.

#### Scenario: An unrecognized condition token is dropped the same way

- **GIVEN** a grant whose `condition` contains a token the system does not
  recognize (not `$self` and not any other supported token)
- **WHEN** a caller holding that grant calls a route requiring it
- **THEN** the rule is dropped (with a logged warning), evaluated the same
  as an unresolvable `$self` token — the system never fails open by
  treating an unrecognized token as an unconditioned (unscoped) grant.
