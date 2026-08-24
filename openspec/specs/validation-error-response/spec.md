# validation-error-response Specification

## Purpose

Defines what field-level and general error detail an HTTP error response body must carry when a request fails DTO validation or a business-rule check, so a client can attribute each message to the right input without parsing the general message string.

## Requirements

### Requirement: Field-level errors accompany the general message
When a request fails class-validator DTO validation, the JSON error response SHALL include both a general `message` string suitable for a toast/summary display, and an `errors` object mapping each invalid property path to an array of one or more human-readable messages for that property.

#### Scenario: Single field fails validation
- **WHEN** a request body fails validation on exactly one property (e.g. a required `name` is missing)
- **THEN** the response body has a top-level `message` string
- **AND** `errors.name` is an array containing at least one message describing the failure

#### Scenario: Multiple fields fail validation
- **WHEN** a request body fails validation on more than one property (e.g. `name` is missing and `email` is malformed)
- **THEN** `errors` contains one key per invalid property (`errors.name`, `errors.email`)
- **AND** each key's value is an array, not a bare string

#### Scenario: A single field fails more than one rule
- **WHEN** a single property fails multiple validation rules (e.g. `email` is both empty and not a valid email format)
- **THEN** `errors.email` is an array containing one message per failed rule
- **AND** no earlier message for that property is overwritten or dropped

#### Scenario: Successful request is unaffected
- **WHEN** a request passes all validation
- **THEN** the response is the normal success payload
- **AND** it contains no `errors` key and no validation-error `message`

### Requirement: Property paths are preserved for nested and indexed properties
When the invalid property lives inside a nested object or an array of objects, the key used in `errors` SHALL preserve the full path from the request body root using dot notation for nested properties and bracket notation for array indices, rather than collapsing to just the leaf property name.

#### Scenario: Nested object property fails validation
- **WHEN** a nested property such as `employee.email` fails validation
- **THEN** the corresponding key in `errors` is `employee.email`, not `email`

#### Scenario: Array item property fails validation
- **WHEN** an item in a validated array property fails validation, e.g. the `quantity` of the item at index `0` in `items`
- **THEN** the corresponding key in `errors` is `items[0].quantity`

#### Scenario: Multiple array items fail validation independently
- **WHEN** more than one item in a validated array fails validation (e.g. `items[0].quantity` and `items[1].quantity`)
- **THEN** `errors` contains a distinct key for each failing item's path, each with its own message array

### Requirement: Business-rule validation failures surface through the same channel
When a request is rejected for a validation reason that is not scoped to one request property (a business rule enforced outside the DTO layer, e.g. "the selected shift is not available"), the response SHALL still carry a general `message` and SHALL still include an `errors` object so a client relying on `errors` for validation feedback does not silently miss the failure.

#### Scenario: Non-field business validation error
- **WHEN** a request is rejected by a business rule that does not correspond to one specific request field
- **THEN** the response has a `message` describing the failure
- **AND** `errors` contains a general key (not attributed to an arbitrary unrelated field) whose array includes that failure's message

### Requirement: Unrelated error responses are unchanged
Error responses that are not request-validation failures (authentication, authorization, not-found, conflict, and unexpected server errors) SHALL keep their current response shape.

#### Scenario: Non-validation error response
- **WHEN** a request fails for a reason other than request validation (e.g. missing/invalid auth, forbidden, not found, conflict, unexpected server error)
- **THEN** the response body's existing fields (status code, message, and any other currently-returned fields) are unchanged
- **AND** no `errors` key is added to that response
