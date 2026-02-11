# Guard Patrol App

This is a mobile application built with React Native and Expo for security guards to manage and conduct patrols efficiently.

## Features

*   **Patrol Management:** Guards can start and end patrol shifts. The app tracks patrol progress, marking hourly checkpoints as "COMPLETED" or "MISSED".
*   **Visitor Management:** Allows for adding new visitors and viewing a list of existing ones.
*   **User Roles:** The application supports two user roles: "guard" and "admin".
*   **Admin Features:** Admins can manage the list of guards. Access to admin features is protected by a PIN.
*   **Data Storage:** Patrol data, guard lists, and visitor information are stored locally on the device.
*   **Data Synchronization:** Patrol data can be synchronized with Google Sheets.

## Tech Stack

*   **Framework:** React Native with Expo
*   **Language:** TypeScript
*   **Navigation:** React Navigation
*   **Local Storage:** @react-native-async-storage/async-storage
*   **Device Features:**
    *   `expo-camera` for scanning QR codes or other patrol checkpoints.
    *   `expo-image-picker` for handling images.