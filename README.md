# Deta Dash App

## Overview
Deta Dash is an intelligent data analysis and dashboard application powered by AI. It allows users to upload their CSV or JSON datasets and automatically generates insightful charts, descriptive tables, and key metrics. Dashboards can be saved and loaded for future reference, leveraging Firebase for data persistence.

## Features
- **Intelligent Data Analysis:** Automatically suggests and visualizes key aspects of your uploaded dataset.
- **Dynamic Chart Generation:** Creates various chart types (Line, Bar, Area) using Recharts.
- **Descriptive Tables:** Summarizes numerical data with statistics and displays frequency distributions for categorical data.
- **Key Metrics Display:** Highlights important statistical metrics derived from your dataset.
- **Dataset Upload:** Supports CSV and JSON file formats.
- **Firebase Integration:** Securely saves and loads generated dashboards for authenticated users.
- **AI-Powered Insights:** Utilizes Google's Gemini API for data analysis suggestions and Imagen API for visualizing concepts.
- **Responsive UI:** Built with React and Tailwind CSS for a modern, adaptive user experience.

## Technologies Used
- **Frontend:** React.js
- **Styling:** Tailwind CSS
- **Charting:** Recharts
- **CSV Parsing:** PapaParse
- **Backend/Database:** Firebase (Authentication & Firestore)
- **AI Models:**
  - Gemini 2.0 Flash: For generating descriptive analysis and dashboard configurations.
  - Imagen 3.0: (Not directly used for the dashboard content, but often paired with similar AI apps for image generation related to the analysis theme if extended.)
- **Deployment:** Vercel (recommended)

## Local Development Setup
To get Deta Dash running on your local machine, follow these steps:

### Prerequisites
- Node.js (LTS version recommended) and npm installed.
  - Download from [Node.js — 在任何地方运行 JavaScript](https://nodejs.org/)
- A code editor (e.g., VS Code).
- A Firebase Project with Firestore enabled.

### Installation
Clone the repository (if you've pulled it from GitHub) or create a new React App:

```bash
# If starting fresh:
npx create-react-app deta-dash-app
cd deta-dash-app

# If you've already cloned/downloaded the project:
# cd your-project-folder (e.g., cd deta-dash-app)
```

Install dependencies:

```bash
npm install recharts papaparse firebase@8.10.0
```

### Environment Variables
Create a `.env` file in the root of your project (same level as `package.json`) and add your Firebase configuration and application ID. Replace the placeholder values with your actual Firebase project settings. You can find these in your Firebase project console under Project settings > Your apps > Web app > Config.

```plaintext
REACT_APP_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
REACT_APP_APP_ID=deta-dash-app # This is your custom app ID for Firestore path
```

**Important:** Do not commit your `.env` file to version control. It is already ignored by default by Create React App's `.gitignore`.

### Running the Application
Once dependencies are installed and your `.env` file is configured, you can start the development server:

```bash
npm start
```

This will open the application in your browser at `http://localhost:3000` (or another available port).

## Deployment
For easy deployment, Vercel is highly recommended due to its seamless integration with GitHub.


## License
This project is open-source and available under the MIT License.

---
Compiled by: elvis07jr
