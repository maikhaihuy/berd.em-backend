# Project Rules

## Domain Description

- **Branch Management**
  - Only Admin can add, update, delete branches.

- **Employee Management**
  - Only Admin can add, update, delete employees.
  - Employee fields: avatar, phone, email, ID number, DOB, gender, address, hire date.
  - An employee can work at multiple branches.

- **Shift Management**
  - Shifts belong to a branch.
  - Shifts can be customized per branch.
  - Shift example: 8:00-16:00, 10:00-16:00, 16:00-22:00.
  - Employees may start/end earlier/later than standard shift hours (recorded in attendance).

- **Special Shift Types**
  - Support custom working hours for special shift types.

- **Leave Requests**
  - Employees can request leave.
  - Employees can request a replacement (future feature, currently disabled).

- **Schedule**
  - Employee availability registration → Manager assigns → Final schedule stored.
  - Managers cannot edit availability after submission.

- **Payroll**
  - Auto-calculate payroll from assigned shifts + attendance data.
  - Compare with actual working hours.

---

## Entities & Relationships

```plantuml
@startuml erd_v0.2

entity User {
  *id : (PK, Int)
  --
  username(String)
  password (String) (Hashed)
  status (enum)
  employeeId (FK, Int?) (Unique)
  --
  createdAt : (DateTime)
  updatedAt : (DateTime)
}

entity RefreshToken {
  *id (PK, Int)
  --
  userId (PK, Int)
  hashedToken (String)
  device (String?)
  ipAddress (String?)
  expiresAt (DateTime)
  createdAt (DateTime)
}

entity PasswordResetToken {
  *id (PK, Int)
  --
  userId (String)
  hashToken (String)
  expiresAt (DateTime)
  createdAt (DateTime)
}

entity Role {
  *id (PK, Int)
  --
  name (String)  (e.g., "admin", "manager", "employee")
  description : (String)
  // Trường hợp phân quyền trên chi nhánh?
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity UserRole {
  *userId (PK, FK, Int)
  *roleId (PK, FK, Int)
}

entity Permission {
  *id (PK, Int)
  --
  action (String) (e.g., "manage", "create", "read", "update", "delete", "verify", "punch_in")
  subject (String) (e.g., "all", "Employee", "ShiftSchedule", "TimeLog", "ownShift")
  condition (Json?)
  description (String?)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity RolePermission {
  *roleId (PK, FK, Int)
  *permissionId (PK, FK, Int)
}

entity Branch {
  *id (PK, Int)
  --
  name (String)
  abbreviation (String)
  address (String)
  email (String?)
  phone (String?)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity Shift {
  *id (PK, Int)
  --
  branchId (FK, Int)
  name (String)
  abbreviation (String)
  maxSlots (Int)
  startTime : (Time)
  endTime : (Time)
  multiplier : (Decimal)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity Employee {
  + id (PK, Int)
  --
  fullName (String)
  phoneNumber (String)
  dateOfBirth (Date?)
  avatar (String?)
  email (String?)
  address (String?)
  probationStartDate (Date?)
  officialStartDate (Date?)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity EmployeeHourlyRate {
  *id (PK, Int)
  --
  employeeId (FK, Int)
  rate (Decimal)
  effectiveDate (Date)
  endDate (Date?)
  note (String?)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity EmployeeBranch {
  *employeeId (PK, FK, Int)
  *branchId (PK, FK, Int)
  IsPrimary (boolean)
}

' the new "ShiftRequest"
entity Availability {
  *id (PK, Int)
  --
  employeeId (FK, Int)
  startTime (DateTimeOffset)
  endTime (DateTimeOffset)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

' the new "ShiftSchedule"
entity Schedule {
  *id (PK, Int)
  --
  shiftId (FK, Int)
  employeeId (FK, Int)
  branchId (FK, Int)
  startTime (DateTimeOffset)
  endTime (DateTimeOffset)
  note (String?)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity LeaveRequest {
  *id (PK, Int)
  --
  scheduleId (Int)
  absenceEmployeeId (Int)
  replacementEmployeeId (Int)
  reason (String)
  approverId (Int)
  status (Enum) // e.g., "Pending", "Approved", "Rejected"
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity TimeLog {
  *id (PK, Int)
  --
  scheduleId (FK, Int)
  employeeId (FK, Int)
  actualStartTime (DateTimeOffset?)
  actualEndTime (DateTimeOffset?)
  requestStartTime (DateTimeOffset?)
  requestEndTime (DateTimeOffset?)
  overtimeMinutes (Int?)
  requestDate (DateTimeOffset?)
  requestReason (String?)
  status (String) // e.g., "Pending", "Submitted", "Adjustment_Requested", "Verified", "Rejected"
  verifiedBy (FK, Int?)
  verifiedAt (DateTimeOffset?)
  note (String?)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity PayPeriod {
  *id (PK, Int)
  --
  startDate (Date)
  endDate (Date)
  status (String) // e.g., "Open", "Closed", "Finalized"
  notes (String?)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity PayrollEntry {
  *id (PK, Int)
  --
  timeLogId (FK, Int)
  employeeId (FK, Int)
  payPeriodId (FK, Int)
  payDate (Date)
  workDate (Date)
  calculatedAt (DateTime)
  calculatedBy (FK, Int)
  totalPay (Decimal)
  --
  createdAt (DateTime)
  createdBy (Int)
  updatedAt (DateTime)
  updatedBy (Int)
}

entity ScheduleHistory {
  *id (PK, Int)
  --
  shiftScheduleId (Int)
  changedById (Int)
  changeDetails (Json)
  changedAt (Datetime)
}

UserRole }o--|| User : "userId"
UserRole }o--|| Role : "roleId"
RolePermission }o--|| Role : "roleId"
RolePermission }o--|| Permission : "permissionId"
RefreshToken }o--|| User : "userId"
PasswordResetToken }o--|| User : "userId"

EmployeeBranch }o--|| Employee : "employeeId"
EmployeeBranch }o--|| Branch : "branchId"
EmployeeHourlyRate }o--|| Employee : "employeeId"
User |o--o| Employee : "employeeId"

Shift }o--|| Branch : "branchId"
Schedule }o--|| Shift : "shiftId"
Schedule }o--|| Employee : "employeeId"
Schedule }o--|| Branch : "branchId"

Availability }o--|| Employee : "employeeId"

LeaveRequest }o--|| Employee : "absenceEmployeeId"
LeaveRequest }o--|| Employee : "replacementEmployeeId"
LeaveRequest }o--|| Schedule : "scheduleId"

TimeLog }o--|| Employee : "employeeId"
TimeLog }o--|| Employee : "verifiedBy"
TimeLog }o--|| Schedule : "shiftScheduleId"

PayrollEntry }o--|| Employee : "employeeId"
PayrollEntry }o--|| PayPeriod : "payPeriodId"
PayrollEntry ||--o| TimeLog : "timeLogId"

ScheduleHistory }o--|| Schedule : "shiftScheduleId"
@enduml
```
