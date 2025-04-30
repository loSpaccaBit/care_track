# CareTrack Mobile

This is a Next.js application designed for home care nurses to track patient services, schedules, and related company information.

## Core Features

*   **Daily Schedule (Home):** View today's patient appointments/tasks in a card-based list. Mark tasks as complete and reschedule if necessary.
*   **Patient Management (Patients):** List all patients with search functionality. View detailed patient profiles, manage assigned care plans, and track performed services.
*   **Calendar View:** Visualize past services and upcoming scheduled plan instances in a calendar format.
*   **Add Data (Aggiungi):** Add and manage Companies and standard Service Plans (Prestazioni).
*   **Profile:** View user details and manage application settings (like notifications).
*   **Automated Hour Calculation (Implicit):** Data structure supports calculating total service hours per company via reporting/exporting.
*   **Offline Functionality (PWA):** The application works offline using Service Workers for caching core assets and potentially data (limited data offline capabilities currently).
*   **Push Notifications (PWA):** Users can enable push notifications to receive reminders for scheduled appointments (requires user permission).

## PWA & Notifications

This application is a Progressive Web App (PWA), installable on compatible devices (iOS & Android).

**Important Note on Notifications:**

*   The current notification system relies on **client-side scheduling** within the Service Worker (`setTimeout`).
*   This method aims to send reminders approximately 10 minutes before a scheduled event **but is inherently unreliable**, especially on mobile operating systems (iOS/Android) which aggressively manage background processes.
*   The Service Worker might be terminated by the OS before the notification timer fires, meaning **notifications are not guaranteed to be delivered**.
*   A more robust solution for reliable, precisely timed notifications requires a **backend server** to send push messages. This client-side implementation is provided based on the request but comes with these limitations.

## Getting Started (Development)

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Set up Firebase:**
    *   Create a Firebase project.
    *   Enable Firestore Database.
    *   Enable Firebase Authentication (Email/Password).
    *   Obtain your Firebase configuration keys.
    *   Create a `.env.local` file in the project root and add your Firebase configuration:
        ```
        NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
        NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

        # VAPID keys for Web Push (generate these)
        NEXT_PUBLIC_VAPID_PUBLIC_KEY=YOUR_PUBLIC_VAPID_KEY
        VAPID_PRIVATE_KEY=YOUR_PRIVATE_VAPID_KEY
        ```
    *   Refer to `firestore-schema.md` and `firestore-example-data.json` to set up your Firestore collections and initial data. Make sure to create the required Firestore indexes prompted by error messages during development.
4.  **Generate VAPID Keys:** You can use tools like `npx web-push generate-vapid-keys` to generate the public and private VAPID keys needed for push notifications.
5.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
6.  Open [http://localhost:9002](http://localhost:9002) (or the specified port) in your browser.

## Firestore Setup

*   Refer to `firestore-schema.md` for the detailed database structure.
*   Use `firestore-example-data.json` as a reference for populating initial data.
*   Ensure you create the necessary composite indexes in Firestore as prompted by errors during application use, particularly for queries involving multiple `where` or `orderBy` clauses.
```