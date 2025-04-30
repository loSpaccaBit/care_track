# CareTrack Mobile - Firestore Database Schema

This document outlines the structure of the Firestore database used by the CareTrack Mobile application.

## Collections

### 1. `companies`

This collection stores information about the healthcare companies that assign patients to nurses.

**Document ID**: Auto-generated Firestore ID or a custom ID (e.g., `c1`, `c2`).

**Fields**:

| Field Name  | Type      | Description                                       | Example              | Required |
| :---------- | :-------- | :------------------------------------------------ | :------------------- | :------- |
| `id`        | `string`  | The unique identifier for the company.            | `c1`                 | Yes      |
| `name`      | `string`  | The name of the company.                          | "HealthCare Inc."    | Yes      |
| `address`   | `string`  | (Optional) The physical address of the company.   | "123 Health St"      | No       |
| `contact`   | `string`  | (Optional) Contact information (phone, email).    | "555-1111"           | No       |

### 2. `patients`

This collection stores information about the patients receiving care.

**Document ID**: Auto-generated Firestore ID or a custom ID (e.g., `p1`, `p2`).

**Fields**:

| Field Name  | Type      | Description                                       | Example              | Required |
| :---------- | :-------- | :------------------------------------------------ | :------------------- | :------- |
| `id`        | `string`  | The unique identifier for the patient.            | `p1`                 | Yes      |
| `name`      | `string`  | The full name of the patient.                     | "Mario Rossi"        | Yes      |
| `companyId` | `string`  | Reference ID to the company in the `companies` collection. | `c1`                 | Yes      |
| `address`   | `string`  | The patient's home address for visits.            | "Via Roma 1, Milano" | Yes      |
| `contact`   | `string`  | The patient's contact phone number.               | "3331234567"         | Yes      |

**Subcollections**:

*   **`assignedPlans`**: See details below.

### 3. `plans`

This collection stores the standard types of services or care plans that can be assigned to patients.

**Document ID**: Auto-generated Firestore ID or a custom ID (e.g., `plan1`, `plan2`).

**Fields**:

| Field Name         | Type      | Description                                            | Example                   | Required |
| :----------------- | :-------- | :----------------------------------------------------- | :------------------------ | :------- |
| `id`               | `string`  | The unique identifier for the plan.                    | `plan1`                   | Yes      |
| `name`             | `string`  | The name of the care plan/service type.                | "Medicazione Semplice"    | Yes      |
| `description`      | `string`  | (Optional) A brief description of the plan.            | "Medicazione ferite..."   | No       |
| `defaultDuration`  | `number`  | The standard duration for this plan in minutes.        | 30                        | Yes      |

### 4. `services`

This collection stores records of individual services (prestazioni) that have been *completed* for a patient.

**Document ID**: Auto-generated Firestore ID (recommended).

**Fields**:

| Field Name         | Type        | Description                                       | Example                       | Required |
| :----------------- | :---------- | :------------------------------------------------ | :---------------------------- | :------- |
| `patientId`        | `string`    | Reference ID to the patient in the `patients` collection. | `p1`                          | Yes      |
| `date`             | `Timestamp` | The date the service was performed.               | Firestore Timestamp object    | Yes      |
| `startTime`        | `string`    | The time the service started (HH:MM format).       | "09:00"                       | Yes      |
| `endTime`          | `string`    | The time the service ended (HH:MM format).         | "09:45"                       | Yes      |
| `description`      | `string`    | A description of the service performed.           | "Medicazione ferita..."       | Yes      |
| `durationMinutes`  | `number`    | The calculated duration of the service in minutes.  | 45                            | Yes      |
| `userId`           | `string`    | ID of the nurse (user) who performed the service. | `firebase_user_uid`         | Yes      |
| `companyId`        | `string`    | ID of the company associated with the patient at the time of service. | `c1`                  | Yes      |

## Subcollections

### `assignedPlans` (Subcollection of `patients`)

This subcollection within each `patient` document lists the care plans assigned to that specific patient, including customizations and scheduled instances.

**Document ID**: The `planId` from the main `plans` collection (e.g., `plan1`, `plan2`).

**Fields**:

| Field Name            | Type        | Description                                               | Example                  | Required |
| :-------------------- | :---------- | :-------------------------------------------------------- | :----------------------- | :------- |
| `planId`              | `string`    | The ID of the plan being assigned (matches document ID).  | `plan1`                  | Yes      |
| `customDuration`      | `number`    | (Optional) Overrides the plan's default duration (minutes). | 35                       | No       |
| `scheduledInstances`  | `Array`     | An array of specific scheduled visits for this plan.      | `[...]` (See below)      | No       |

**Structure of `scheduledInstances` Array Objects**:

Each object within the `scheduledInstances` array represents a single planned visit.

| Field Name | Type        | Description                                         | Example                  | Required |
| :--------- | :---------- | :-------------------------------------------------- | :----------------------- | :------- |
| `date`     | `Timestamp` | The specific date for this scheduled instance.       | Firestore Timestamp object | Yes      |
| `time`     | `string`    | (Optional) The specific time (HH:MM) for the visit. | "10:30"                  | No       |

---

**Note:** Using Firestore Timestamps for dates allows for easier querying and sorting based on time. Ensure dates are stored consistently (e.g., at the start of the day if only the date matters, or with specific times when relevant). When fetching data for display, convert Timestamps to JavaScript Date objects.
