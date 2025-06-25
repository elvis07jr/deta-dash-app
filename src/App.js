import React, { useState, useEffect, useRef } from 'react';
// PapaParse will be loaded via CDN, making it available on window.Papa
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'; // Charting library for React

// Assume PapaParse is available globally
const Papa = window.Papa;

// Access global Firebase config and app ID provided by the environment
// Conditionally use global variables (for Canvas) or process.env (for local development)
const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config) // If running in this Canvas environment, use the provided global config
    : {
        // If __firebase_config is undefined (meaning you're likely running locally),
        // then try to get the values from your .env file via process.env
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID // This is Firebase's own appId property
    };

const appId = typeof __app_id !== 'undefined'
    ? __app_id // If running in this Canvas environment, use the provided global app ID
    : (process.env.REACT_APP_APP_ID || 'deta-dash-app'); // Otherwise, use the one from .env or a default

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; // Similarly for the auth token

// Define a sample limit for statistical calculations to prevent stack overflow
const DATA_SAMPLE_LIMIT_FOR_CALCS = 1000; // Limit to first 1000 rows for calculations

// Main App component for the Deta Dash App
const App = () => {
    // State for user inputs
    const [datasetFile, setDatasetFile] = useState(null);

    // State for data and AI outputs
    const [chartData, setChartData] = useState([]); // Parsed raw data for charts
    const [autoAnalysisResult, setAutoAnalysisResult] = useState(null); // AI-generated multiple charts, tables, metrics

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [currentPage, setCurrentPage] = useState('generator'); // 'generator' or 'dashboard'

    // Firebase states and instances managed within the component
    const [userId, setUserId] = useState(null);
    const [firebaseReady, setFirebaseReady] = useState(false);
    const [appInstance, setAppInstance] = useState(null);
    const [dbInstance, setDbInstance] = useState(null);
    const [authInstance, setAuthInstance] = useState(null);
    const [savedDashboards, setSavedDashboards] = useState([]); // Stores saved dashboards
    const [selectedSavedDashboardId, setSelectedSavedDashboardId] = useState(null);

    // Toggle for metrics display
    const [showMetrics, setShowMetrics] = useState(false);

    // Track script loading status
    const scriptLoadStatus = useRef({ app: false, auth: false, firestore: false, papaparse: false });

    // Effect to dynamically load PapaParse and Firebase SDKs
    useEffect(() => {
        const loadScript = (id, src, onloadCallback) => {
            if (document.getElementById(id)) {
                onloadCallback();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.id = id;
            script.async = true;
            script.onload = onloadCallback;
            script.onerror = () => {
                setErrorMessage(`Failed to load script: ${src}. Please check your internet connection.`);
                console.error(`Error loading script: ${src}`);
            };
            document.head.appendChild(script);
        };

        const checkAllScriptsLoaded = () => {
            if (scriptLoadStatus.current.app &&
                scriptLoadStatus.current.auth &&
                scriptLoadStatus.current.firestore &&
                scriptLoadStatus.current.papaparse &&
                window.firebase && window.firebase.auth && window.firebase.firestore && window.Papa
            ) {
                console.log("All core scripts and global objects are ready.");
                if (!appInstance) {
                    try {
                        const initializedApp = window.firebase.initializeApp(firebaseConfig);
                        // Get auth and firestore instances directly from the initialized app instance
                        const auth = initializedApp.auth();
                        const db = initializedApp.firestore();

                        setAppInstance(initializedApp);
                        setAuthInstance(auth);
                        setDbInstance(db);
                        console.log("Firebase app, auth, db instances set.");

                        auth.onAuthStateChanged(user => {
                            if (user) {
                                setUserId(user.uid);
                                setFirebaseReady(true);
                                console.log("Firebase user signed in:", user.uid);
                            } else {
                                console.log("No user signed in. Attempting anonymous sign-in or custom token sign-in.");
                                if (initialAuthToken) {
                                    auth.signInWithCustomToken(initialAuthToken)
                                        .then(() => console.log("Signed in with custom token."))
                                        .catch((error) => {
                                            console.error("Custom token sign-in failed:", error);
                                            setErrorMessage("Firebase sign-in failed. Data saving will not work.");
                                        });
                                } else {
                                    auth.signInAnonymously()
                                        .then(() => console.log("Signed in anonymously."))
                                        .catch((error) => {
                                            console.error("Anonymous sign-in failed:", error);
                                            setErrorMessage("Firebase sign-in failed. Data saving will not work.");
                                        });
                                }
                            }
                        });

                    } catch (error) {
                        console.error("Error initializing Firebase after script load:", error);
                        setErrorMessage("Failed to initialize Firebase SDK. Data saving will not work.");
                    }
                }
            } else {
                // console.log("Waiting for all scripts/globals to load...", scriptLoadStatus.current);
            }
        };

        // Load Firebase SDKs (using v8 for global access)
        loadScript('firebase-app-cdn', 'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js', () => {
            scriptLoadStatus.current.app = true;
            checkAllScriptsLoaded();
        });
        loadScript('firebase-auth-cdn', 'https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js', () => {
            scriptLoadStatus.current.auth = true;
            checkAllScriptsLoaded();
        });
        loadScript('firebase-firestore-cdn', 'https://www.gstatic.com/firebasejs/8.10.0/firebase-firestore.js', () => {
            scriptLoadStatus.current.firestore = true;
            checkAllScriptsLoaded();
        });
        // Load PapaParse
        loadScript('papaparse-cdn', 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js', () => {
            scriptLoadStatus.current.papaparse = true;
            checkAllScriptsLoaded();
        });

        // Cleanup: Remove scripts if component unmounts
        return () => {
            const scripts = ['firebase-app-cdn', 'firebase-auth-cdn', 'firebase-firestore-cdn', 'papaparse-cdn'];
            scripts.forEach(id => {
                const script = document.getElementById(id);
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
            });
        };
    }, []); // Empty dependency array ensures this runs once on mount


    // Effect to load saved dashboards from Firestore when userId and dbInstance become available
    useEffect(() => {
        if (!firebaseReady || !userId || !dbInstance) {
            console.log("Firebase not ready to fetch dashboards yet.");
            return;
        }

        const dashboardsCollectionRef = dbInstance.collection(`artifacts/${appId}/users/${userId}/dashboards`);
        const q = dashboardsCollectionRef.orderBy('timestamp', 'desc');

        const unsubscribe = q.onSnapshot((snapshot) => {
            const fetchedDashboards = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSavedDashboards(fetchedDashboards);
            console.log("Fetched saved dashboards:", fetchedDashboards);
        }, (error) => {
            console.error("Error fetching saved dashboards:", error);
            setErrorMessage("Failed to load saved dashboards.");
        });

        return () => unsubscribe();
    }, [firebaseReady, userId, dbInstance, appId]);


    // Handle dataset file upload
    const handleDatasetFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setDatasetFile(file);
            setErrorMessage('');
            setSuccessMessage('');
            parseDataset(file);
        } else {
            setDatasetFile(null);
            setChartData([]);
            setAutoAnalysisResult(null);
        }
    };

    // Function to parse uploaded dataset (CSV or JSON)
    const parseDataset = (file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                let parsedData = [];

                if (file.type === 'application/json') {
                    parsedData = JSON.parse(text);
                } else if (file.type === 'text/csv') {
                    if (typeof window.Papa === 'undefined') {
                        setErrorMessage('PapaParse library is not yet loaded. Please wait a moment or refresh.');
                        return;
                    }
                    window.Papa.parse(text, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            if (!Array.isArray(results.data) || results.data.length === 0) {
                                setErrorMessage('CSV dataset is empty or malformed.');
                                setChartData([]);
                                return;
                            }
                            setChartData(results.data);
                            setSuccessMessage('Dataset parsed successfully! Ready for analysis.');
                        },
                        error: (err) => {
                            setErrorMessage(`CSV parsing error: ${err.message}`);
                            setChartData([]);
                        }
                    });
                    return;
                } else {
                    throw new Error('Unsupported file type. Please upload a CSV or JSON file.');
                }

                if (!Array.isArray(parsedData) || parsedData.length === 0) {
                    throw new Error('Dataset is empty or malformed.');
                }
                setChartData(parsedData);
                setSuccessMessage('Dataset parsed successfully! Ready for analysis.');
            } catch (error) {
                setErrorMessage(`Error parsing dataset: ${error.message}`);
                setChartData([]);
            }
        };
        reader.readAsText(file);
    };

    // Helper function to dynamically calculate descriptive statistics
    const getDescriptiveStatistics = (data, numericalCols) => {
        const stats = {};
        // Use a sliced version of data to prevent stack overflow on large datasets
        const sampledData = data.slice(0, DATA_SAMPLE_LIMIT_FOR_CALCS);

        numericalCols.forEach(col => {
            const values = sampledData.map(row => parseFloat(row[col])).filter(val => !isNaN(val));
            if (values.length > 0) {
                const sum = values.reduce((a, b) => a + b, 0);
                const mean = sum / values.length;
                const sorted = [...values].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
                const min = Math.min(...values);
                const max = Math.max(...values);
                const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
                const stdDev = Math.sqrt(variance);

                stats[col] = {
                    mean: mean.toFixed(2),
                    median: median.toFixed(2),
                    min: min.toFixed(2),
                    max: max.toFixed(2),
                    stdDev: stdDev.toFixed(2),
                    count: values.length
                };
            }
        });
        return stats;
    };

    // Helper function to calculate frequency distribution for categorical data
    const getFrequencyDistribution = (data, categoricalCols) => {
        const distributions = {};
        // Use a sliced version of data to prevent stack overflow on large datasets
        const sampledData = data.slice(0, DATA_SAMPLE_LIMIT_FOR_CALCS);

        categoricalCols.forEach(col => {
            const counts = {};
            sampledData.forEach(row => {
                const value = row[col];
                if (value !== undefined && value !== null && value !== '') {
                    counts[value] = (counts[value] || 0) + 1;
                }
            });
            distributions[col] = counts;
        });
        return distributions;
    };

    // Main function to analyze data and generate dashboard components
    const analyzeAndGenerateDashboard = async () => {
        if (!chartData.length) {
            setErrorMessage('Please upload a dataset first.');
            return;
        }
        if (!firebaseReady || !userId || !dbInstance) {
            setErrorMessage('Firebase is not ready. Please wait or refresh to save dashboards.');
            return;
        }

        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        setAutoAnalysisResult(null); // Clear previous results

        try {
            const dataKeys = Object.keys(chartData[0]);
            // The prompt has been updated to explicitly request minified JSON output to reduce response size.
            const analysisPrompt = `
                Analyze the following dataset and deduce the best features (columns) to visualize.
                Then, generate a structured JSON output that includes:
                1. At least 4 distinct chart configurations (LineChart, BarChart, AreaChart). For each, select appropriate data keys for XAxis and YAxis, and suggest a creative, modern color palette (hex codes or simple gradients). Ensure data keys chosen for y-axis are numerical.
                2. Instructions for 2-3 descriptive tables, specifying what kind of summary (e.g., "summary statistics for numerical columns", "frequency distribution for categorical columns", "top N values of X by Y") should be generated. Do NOT generate the table data itself.
                3. 2-3 key metrics from the dataset, with a label, calculated value, and unit (if applicable).

                Dataset columns: ${JSON.stringify(dataKeys)}.

                Focus on creating insightful and aesthetically pleasing visualizations and summaries.
                The JSON output should strictly follow this schema.
                Generate the JSON output in a **minified format** (no extra whitespace or newlines) to optimize for parsing efficiency.
                {
                    "charts": [
                        {
                            "chartType": "LineChart" | "BarChart" | "AreaChart",
                            "xAxis": { "dataKey": "string", "label": "string" },
                            "yAxis": { "dataKey": "string", "label": "string" },
                            "dataLinesOrBarsOrAreas": [
                                { "type": "line" | "bar", "dataKey": "string", "stroke": "string", "fill": "string", "activeDot": "boolean" },
                                { "type": "area", "dataKey": "string", "stroke": "string", "fill": "string", "activeDot": "boolean", "type": "monotone" }
                            ],
                            "colors": ["string"],
                            "grid": "boolean",
                            "tooltip": "boolean",
                            "legend": "boolean",
                            "title": "string"
                        }
                        // ... up to 4 charts
                    ],
                    "tableDescriptions": [
                        { "title": "string", "type": "string", "columns": ["string"] },
                        { "title": "string", "type": "string", "column": "string" }
                        // ... up to 3 tables
                    ],
                    "metrics": [
                        { "label": "string", "value": "string", "unit": "string" }
                        // ... up to 3 metrics
                    ]
                }
                Make sure 'dataLinesOrBarsOrAreas' contains objects with 'dataKey' that exist in the provided dataset columns.
                For 'BarChart', 'fill' is important. For 'LineChart', 'stroke' is important. For 'AreaChart', 'fill' and 'stroke' are important.
                For 'AreaChart' 'type' should be 'monotone'.
                For 'BarChart' use a subtle gradient fill if possible.
                For 'colors', use a vibrant and modern palette.
                Provide only the JSON.
            `;

            const apiKey = "";
            const analysisApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const analysisPayload = {
                contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            "charts": {
                                "type": "ARRAY",
                                "items": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "chartType": { "type": "STRING", "enum": ["LineChart", "BarChart", "AreaChart"] },
                                        "xAxis": { "type": "OBJECT", "properties": { "dataKey": { "type": "STRING" }, "label": { "type": "STRING" } } },
                                        "yAxis": { "type": "OBJECT", "properties": { "dataKey": { "type": "STRING" }, "label": { "type": "STRING" } } },
                                        "dataLinesOrBarsOrAreas": {
                                            "type": "ARRAY",
                                            "items": {
                                                "type": "OBJECT",
                                                "properties": {
                                                    "type": { "type": "STRING", "enum": ["line", "bar", "area"] },
                                                    "dataKey": { "type": "STRING" },
                                                    "stroke": { "type": "STRING" },
                                                    "fill": { "type": "STRING" },
                                                    "activeDot": { "type": "BOOLEAN" }
                                                },
                                                "required": ["dataKey"]
                                            }
                                        },
                                        "colors": { "type": "ARRAY", "items": { "type": "STRING" } },
                                        "grid": { "type": "BOOLEAN" },
                                        "tooltip": { "type": "BOOLEAN" },
                                        "legend": { "type": "BOOLEAN" },
                                        "title": { "type": "STRING" }
                                    },
                                    "required": ["chartType", "xAxis", "yAxis", "dataLinesOrBarsOrAreas", "colors", "grid", "tooltip", "legend", "title"]
                                },
                                "minItems": 4
                            },
                            "tableDescriptions": {
                                "type": "ARRAY",
                                "items": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "title": { "type": "STRING" },
                                        "type": { "type": "STRING", "enum": ["summary_statistics", "frequency_distribution", "top_n_values"] },
                                        "columns": { "type": "ARRAY", "items": { "type": "STRING" } },
                                        "column": { "type": "STRING" },
                                        "groupByColumn": { "type": "STRING" },
                                        "nValue": { "type": "NUMBER" }
                                    },
                                    "required": ["title", "type"]
                                },
                                "minItems": 2
                            },
                            "metrics": {
                                "type": "ARRAY",
                                "items": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "label": { "type": "STRING" },
                                        "value": { "type": "STRING" },
                                        "unit": { "type": "STRING" }
                                    },
                                    "required": ["label", "value"]
                                },
                                "minItems": 2
                            }
                        },
                        "required": ["charts", "tableDescriptions", "metrics"]
                    }
                }
            };

            const analysisResponse = await fetch(analysisApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(analysisPayload)
            });

            if (!analysisResponse.ok) {
                const errorText = await analysisResponse.text();
                console.error("Gemini Analysis API Error:", analysisResponse.status, analysisResponse.statusText, errorText);
                setErrorMessage(`Failed to analyze data: ${analysisResponse.statusText}. Check console for details.`);
                setIsLoading(false);
                return;
            }

            const analysisResult = await analysisResponse.json();
            console.log("Gemini Analysis Result:", analysisResult);

            if (analysisResult.candidates && analysisResult.candidates.length > 0 &&
                analysisResult.candidates[0].content && analysisResult.candidates[0].content.parts &&
                analysisResult.candidates[0].content.parts.length > 0) {
                const jsonText = analysisResult.candidates[0].content.parts[0].text;
                let parsedDashboardConfig;
                try {
                    // Attempt to parse the JSON. This is where "Maximum call stack size exceeded" often occurs
                    // if the jsonText string is extremely long or deeply nested.
                    parsedDashboardConfig = JSON.parse(jsonText);
                } catch (jsonParseError) {
                    console.error("JSON Parsing Error:", jsonParseError);
                    setErrorMessage(`Error parsing AI-generated JSON config: ${jsonParseError.message}. This often happens with very large or complex JSON responses from the AI. Raw JSON (truncated): ${jsonText.substring(0, 500)}...`);
                    setIsLoading(false);
                    return; // Stop further processing if JSON parsing fails
                }

                // --- Process Charts: Validate dataKeys and assign defaults if needed ---
                const availableDataKeys = Object.keys(chartData[0]);
                parsedDashboardConfig.charts = parsedDashboardConfig.charts.map(chart => {
                    const validDataLinesOrBarsOrAreas = chart.dataLinesOrBarsOrAreas.filter(item =>
                        availableDataKeys.includes(item.dataKey)
                    );
                    if (validDataLinesOrBarsOrAreas.length === 0 && chart.dataLinesOrBarsOrAreas.length > 0) {
                         console.warn(`Chart '${chart.title}': AI suggested dataKeys not found in dataset. Attempting to use default or first available.`);
                         let defaultDataKeys = availableDataKeys.filter(key => !isNaN(parseFloat(chartData[0][key]))).slice(0, 2);
                         if (defaultDataKeys.length > 0) {
                             chart.dataLinesOrBarsOrAreas = defaultDataKeys.map(key => ({
                                 type: chart.chartType === 'BarChart' ? 'bar' : (chart.chartType === 'AreaChart' ? 'area' : 'line'),
                                 dataKey: key, // Use actual numeric key
                                 stroke: chart.colors[0] || "#8884d8",
                                 fill: chart.colors[0] || "#8884d8",
                                 activeDot: true
                             }));
                              // Also attempt to set xAxis if not already set, using the first non-numeric key
                             if (!chart.xAxis || !chart.xAxis.dataKey) {
                                 const firstNonNumericKey = availableDataKeys.find(key => !isNaN(parseFloat(chartData[0][key])));
                                 if (firstNonNumericKey) {
                                     chart.xAxis = { dataKey: firstNonNumericKey, label: firstNonNumericKey };
                                 }
                             }
                         } else {
                             console.warn(`Chart '${chart.title}': No suitable numeric data keys found for fallback. Removing chart.`);
                             return null; // Mark chart for removal
                         }
                    } else if (validDataLinesOrBarsOrAreas.length !== chart.dataLinesOrBarsOrAreas.length) {
                        chart.dataLinesOrBarsOrAreas = validDataLinesOrBarsOrAreas;
                        console.warn(`Chart '${chart.title}': Some AI suggested dataKeys were invalid and filtered out.`);
                    }
                    return chart;
                }).filter(Boolean); // Remove null charts

                // --- Process Tables: Generate data based on AI's descriptions ---
                const generatedTables = parsedDashboardConfig.tableDescriptions.map(tableDesc => {
                    let tableData = [];
                    if (tableDesc.type === 'summary_statistics' && tableDesc.columns) {
                        // Pass sampled data to getDescriptiveStatistics
                        tableData = getDescriptiveStatistics(chartData, tableDesc.columns);
                    } else if (tableDesc.type === 'frequency_distribution' && tableDesc.column) {
                        // Pass sampled data to getFrequencyDistribution
                        tableData = getFrequencyDistribution(chartData, [tableDesc.column]);
                    } else if (tableDesc.type === 'top_n_values' && tableDesc.columns && tableDesc.groupByColumn && tableDesc.nValue) {
                        // This would require more complex aggregation,
                        // for simplicity, let's just return a message or a small sample
                        // A full implementation would involve grouping, summing/averaging, and sorting.
                        tableData = [{ note: `Top ${tableDesc.nValue} values for ${tableDesc.columns.join(',')} grouped by ${tableDesc.groupByColumn} not fully implemented in frontend.` }];
                    }
                    return { ...tableDesc, data: tableData };
                });
                parsedDashboardConfig.tables = generatedTables;

                // Set the full auto-analysis result
                setAutoAnalysisResult(parsedDashboardConfig);
                setSuccessMessage('Dashboard generated successfully!');

                // --- Save dashboard to Firestore ---
                if (firebaseReady && userId && dbInstance) {
                    dbInstance.collection(`artifacts/${appId}/users/${userId}/dashboards`).add({
                        userId: userId,
                        // Store only a reference to the data, not the full raw data
                        // Store essential parts of the generated analysis for loading
                        dashboardConfig: parsedDashboardConfig,
                        timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                        datasetMetadata: {
                            name: datasetFile ? datasetFile.name : 'Uploaded Dataset',
                            keys: dataKeys,
                            // Removed datasetSample from here as well to keep Firestore document size smaller
                            // sample: datasetSample // Keep a small sample for dashboard preview
                        }
                    }).then(() => {
                        setSuccessMessage('Dashboard generated and saved successfully!');
                        console.log("Dashboard saved to Firestore!");
                    }).catch((error) => {
                        console.error("Error saving dashboard to Firestore:", error);
                        setErrorMessage("Failed to save dashboard to Firestore.");
                    });
                } else {
                    console.warn("Firebase not ready or dbInstance not initialized, dashboard not saved.");
                    setErrorMessage("Firebase not ready or dbInstance not initialized, dashboard could not be saved. Please refresh.");
                }

            } else {
                console.error("Gemini Analysis: Unexpected response structure or content missing.", analysisResult);
                setErrorMessage("Could not generate dashboard configuration. AI response was unexpected.");
            }

        } catch (error) {
            console.error("Error generating dashboard:", error);
            setErrorMessage(`An unexpected error occurred: ${error.message}.`);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to render the appropriate chart component based on config
    const renderChartComponent = (configToRender, dataToRender) => {
        if (!configToRender || !dataToRender.length) return null;

        const { chartType, xAxis, yAxis, dataLinesOrBarsOrAreas, grid, tooltip, legend, title } = configToRender;

        // Ensure data keys are parsed as numbers if they represent numeric values
        const processedChartData = dataToRender.map(row => {
            const newRow = { ...row };
            if (xAxis && row[xAxis.dataKey] !== undefined) {
                const val = parseFloat(row[xAxis.dataKey]);
                if (!isNaN(val)) newRow[xAxis.dataKey] = val;
            }
            if (yAxis && row[yAxis.dataKey] !== undefined) {
                const val = parseFloat(row[yAxis.dataKey]);
                if (!isNaN(val)) newRow[yAxis.dataKey] = val;
            }
            dataLinesOrBarsOrAreas.forEach(item => {
                if (item.dataKey && row[item.dataKey] !== undefined) {
                    const val = parseFloat(row[item.dataKey]);
                    if (!isNaN(val)) newRow[item.dataKey] = val;
                }
            });
            return newRow;
        });

        const defs = configToRender.colors.map((color, index) => {
            if (color.includes('url(#')) return null;
            const baseColor = color.startsWith('#') ? color : "#8884d8";
            const darkerColor = baseColor + '80';
            return (
                <linearGradient key={`colorGradient-${index}`} id={`colorGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={baseColor} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={darkerColor} stopOpacity={0.2}/>
                </linearGradient>
            );
        }).filter(Boolean);

        const chartProps = {
            data: processedChartData,
            margin: { top: 20, right: 30, left: 20, bottom: 5 },
            style: {
                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                borderRadius: '8px',
                padding: '10px'
            }
        };

        const renderLinesBarsAreas = () => {
            return dataLinesOrBarsOrAreas.map((item, index) => {
                const effectiveColor = item.fill || item.stroke || configToRender.colors[index % configToRender.colors.length] || "#8884d8";
                const fillId = `colorGradient-${index % configToRender.colors.length}`;

                if (chartType === 'LineChart' && item.type === 'line') {
                    return <Line
                        key={item.dataKey}
                        type="monotone"
                        dataKey={item.dataKey}
                        stroke={effectiveColor}
                        activeDot={item.activeDot !== undefined ? item.activeDot : true}
                        strokeWidth={2}
                    />;
                } else if (chartType === 'BarChart' && item.type === 'bar') {
                     return <Bar
                        key={item.dataKey}
                        dataKey={item.dataKey}
                        fill={defs.length > 0 ? `url(#${fillId})` : effectiveColor}
                        fillOpacity={defs.length > 0 ? 1 : 0.8}
                     />;
                } else if (chartType === 'AreaChart' && item.type === 'area') {
                    return <Area
                        key={item.dataKey}
                        type="monotone"
                        dataKey={item.dataKey}
                        stroke={effectiveColor}
                        fill={defs.length > 0 ? `url(#${fillId})` : effectiveColor}
                        fillOpacity={defs.length > 0 ? 1 : 0.6}
                        activeDot={item.activeDot !== undefined ? item.activeDot : true}
                    />;
                }
                return null;
            });
        };

        const ChartComponent = { LineChart, BarChart, AreaChart }[chartType];

        if (!ChartComponent) {
            return <p className="text-red-400 text-center">Unsupported chart type: {chartType}</p>;
        }

        return (
            <div className="w-full h-auto"> {/* Wrapper for title and chart */}
                {title && <h3 className="text-xl font-semibold text-white text-center mb-4">{title}</h3>}
                <ResponsiveContainer width="100%" height={400}>
                    <ChartComponent {...chartProps}>
                        <defs>
                            {defs}
                        </defs>
                        {grid && <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />}
                        <XAxis
                            dataKey={xAxis.dataKey}
                            label={xAxis.label ? { value: xAxis.label, position: 'insideBottom', offset: -5, fill: '#cbd5e1' } : null}
                            stroke="#cbd5e1"
                            tick={{ fill: '#cbd5e1' }}
                        />
                        <YAxis
                            label={yAxis.label ? { value: yAxis.label, angle: -90, position: 'insideLeft', fill: '#cbd5e1' } : null}
                            stroke="#cbd5e1"
                            tick={{ fill: '#cbd5e1' }}
                        />
                        {tooltip && <Tooltip
                            contentStyle={{ backgroundColor: '#2d3748', border: '1px solid #4a5568', borderRadius: '8px' }}
                            labelStyle={{ color: '#a0aec0' }}
                            itemStyle={{ color: '#e2e8f0' }}
                        />}
                        {legend && <Legend wrapperStyle={{ color: '#e2e8f0', paddingTop: '10px' }} />}
                        {renderLinesBarsAreas()}
                    </ChartComponent>
                </ResponsiveContainer>
            </div>
        );
    };

    // Function to handle selection of a saved dashboard
    const handleSelectSavedDashboard = (dashboard) => {
        setAutoAnalysisResult(dashboard.dashboardConfig);
        // We will not load the full dataset, only rely on the sample for rendering
        // In a real app, you might re-fetch the full dataset if needed for interactivity.
        setChartData(dashboard.datasetMetadata?.sample || []);
        setSelectedSavedDashboardId(dashboard.id);
        setErrorMessage('');
        setSuccessMessage(`Loaded dashboard: ${dashboard.id}`);
        setCurrentPage('generator'); // Go back to generator view to see it
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-gray-900 text-white font-inter p-4 sm:p-8 flex items-center justify-center">
            <div className="bg-gray-800 bg-opacity-80 backdrop-blur-sm p-6 sm:p-10 rounded-xl shadow-2xl w-full max-w-5xl border border-gray-600 transform transition-all duration-300 hover:scale-[1.01]">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
                        Deta Dash
                    </h1>
                    <button
                        onClick={() => setCurrentPage(currentPage === 'generator' ? 'dashboard' : 'generator')}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                        {currentPage === 'generator' ? 'My Dashboards' : 'New Analysis'}
                    </button>
                </div>
                <p className="text-center text-gray-300 mb-8 text-lg max-w-2xl mx-auto">
                    Upload your dataset, and let AI automatically generate insightful charts, tables, and key metrics.
                </p>

                {userId && firebaseReady && (
                    <p className="text-center text-sm text-gray-400 mb-4">
                        Your User ID: <span className="font-mono text-blue-300">{userId}</span> (Dashboards are saved automatically)
                    </p>
                )}
                 {errorMessage && (
                    <p className="text-red-400 text-base mb-4 text-center">{errorMessage}</p>
                )}
                {successMessage && (
                    <p className="text-green-400 text-base mb-4 text-center">{successMessage}</p>
                )}


                {currentPage === 'generator' && (
                    <div className="input-section">
                        {/* Input Section */}
                        <div className="mb-8 p-6 bg-gray-700 bg-opacity-60 rounded-lg border border-gray-500">
                            <div className="grid grid-cols-1 gap-6 mb-6">
                                {/* Dataset Upload */}
                                <div>
                                    <label htmlFor="dataset-upload" className="block text-lg font-semibold mb-2 text-cyan-200">
                                        1. Upload Your Dataset (CSV or JSON):
                                    </label>
                                    <input
                                        type="file"
                                        id="dataset-upload"
                                        accept=".csv,.json"
                                        onChange={handleDatasetFileChange}
                                        className="w-full text-sm text-gray-300
                                                   file:mr-4 file:py-2 file:px-4
                                                   file:rounded-full file:border-0
                                                   file:text-sm file:font-semibold
                                                   file:bg-purple-500 file:text-white
                                                   hover:file:bg-purple-600 file:transition-colors file:duration-200
                                                   cursor-pointer"
                                        disabled={isLoading}
                                    />
                                    {datasetFile && (
                                        <p className="text-sm text-gray-400 mt-2">Selected: {datasetFile.name}</p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={analyzeAndGenerateDashboard}
                                className="mt-4 w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoading || !datasetFile || !firebaseReady || chartData.length === 0}
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center">
                                        <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Analyzing & Generating Dashboard...
                                    </div>
                                ) : (
                                    'Analyze Data & Generate Dashboard'
                                )}
                            </button>
                        </div>

                        {/* Generated Dashboard Output Section */}
                        {autoAnalysisResult && chartData.length > 0 && (
                            <div className="mt-8 p-6 bg-gray-800 bg-opacity-70 rounded-xl border border-blue-500 shadow-xl">
                                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-yellow-300 mb-6 text-center">
                                    AI-Generated Dashboard
                                </h2>

                                {/* Metrics Section */}
                                <div className="mb-8 text-center">
                                    <button
                                        onClick={() => setShowMetrics(!showMetrics)}
                                        className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-full shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                    >
                                        {showMetrics ? 'Hide Key Metrics' : 'Show Key Metrics'}
                                    </button>
                                    {showMetrics && autoAnalysisResult.metrics && (
                                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-700 bg-opacity-50 rounded-lg">
                                            {autoAnalysisResult.metrics.map((metric, index) => (
                                                <div key={index} className="bg-gray-600 p-3 rounded-md shadow-sm border border-gray-500">
                                                    <p className="text-gray-300 text-sm">{metric.label}</p>
                                                    <p className="text-xl font-bold text-green-300">{metric.value} {metric.unit}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Charts Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                    {autoAnalysisResult.charts.map((chartConfig, index) => (
                                        <div key={index} className="bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
                                            {renderChartComponent(chartConfig, chartData)}
                                        </div>
                                    ))}
                                </div>

                                {/* Tables Section */}
                                <div className="mb-8">
                                    <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-red-300 mb-4 text-center">
                                        Descriptive Tables
                                    </h3>
                                    {autoAnalysisResult.tables.map((table, tableIndex) => (
                                        <div key={tableIndex} className="bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600 mb-6">
                                            <h4 className="text-xl font-semibold text-white mb-3">{table.title}</h4>
                                            {table.data && (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full bg-gray-800 rounded-md">
                                                        <thead> {/* Ensure thead is always present and valid */}
                                                            {table.type === 'summary_statistics' && table.data && Object.keys(table.data).length > 0 && (
                                                                <tr className="bg-gray-900">
                                                                    <th className="py-2 px-4 text-left text-gray-300">Metric</th>
                                                                    {Object.keys(Object.values(table.data)[0] || {}).map(key => (
                                                                        <th key={key} className="py-2 px-4 text-left text-gray-300">{key.charAt(0).toUpperCase() + key.slice(1)}</th>
                                                                    ))}
                                                                </tr>
                                                            )}
                                                            {table.type === 'frequency_distribution' && table.column && table.data[table.column] && Object.keys(table.data[table.column]).length > 0 && (
                                                                <tr className="bg-gray-900">
                                                                    <th className="py-2 px-4 text-left text-gray-300">{table.column}</th>
                                                                    <th key="count" className="py-2 px-4 text-left text-gray-300">Count</th>
                                                                </tr>
                                                            )}
                                                            {/* Add a default header row for top_n_values or empty state if no other headers apply */}
                                                            {table.type === 'top_n_values' && (
                                                                <tr className="bg-gray-900">
                                                                    <th className="py-2 px-4 text-left text-gray-300" colSpan="100%">Information</th>
                                                                </tr>
                                                            )}
                                                            {(!table.data || (table.type === 'summary_statistics' && Object.keys(table.data).length === 0) || (table.type === 'frequency_distribution' && (!table.column || !table.data[table.column] || Object.keys(table.data[table.column]).length === 0))) && (
                                                                <tr className="bg-gray-900">
                                                                    <th className="py-2 px-4 text-left text-gray-300" colSpan="100%">No data available for this table.</th>
                                                                </tr>
                                                            )}
                                                        </thead>
                                                        <tbody>
                                                            {table.type === 'summary_statistics' && Object.keys(table.data).map((colName, rowIndex) => (
                                                                <tr key={rowIndex} className="border-t border-gray-600">
                                                                    <td className="py-2 px-4 text-white font-medium">{colName}</td>
                                                                    {Object.values(table.data[colName]).map((val, i) => (
                                                                        <td key={i} className="py-2 px-4 text-gray-300">{val}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                            {table.type === 'frequency_distribution' && table.column && Object.keys(table.data[table.column] || {}).map((value, rowIndex) => (
                                                                <tr key={rowIndex} className="border-t border-gray-600">
                                                                    <td className="py-2 px-4 text-white font-medium">{value}</td>
                                                                    <td className="py-2 px-4 text-gray-300">{table.data[table.column][value]}</td>
                                                                </tr>
                                                            ))}
                                                            {table.type === 'top_n_values' && (
                                                                <tr><td colSpan="100%" className="py-2 px-4 text-gray-300 italic">{table.data[0]?.note || "Data not available for this table type in frontend."}</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                            {!table.data && (
                                                <p className="text-gray-400">No data generated for this table type (frontend processing missing).</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentPage === 'dashboard' && (
                    <div className="dashboard-section">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                            My Saved Dashboards
                        </h2>
                        {!firebaseReady && (
                            <p className="text-red-400 text-center mb-4">
                                Loading Firebase... Please wait to see your saved dashboards.
                            </p>
                        )}
                        {firebaseReady && savedDashboards.length === 0 && !isLoading && (
                            <p className="text-gray-400 text-center text-lg">
                                No dashboards saved yet. Go to "New Analysis" to create your first dashboard!
                            </p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {savedDashboards.map((dashboard) => (
                                <div
                                    key={dashboard.id}
                                    onClick={() => handleSelectSavedDashboard(dashboard)}
                                    className={`bg-gray-700 bg-opacity-70 rounded-xl p-4 cursor-pointer hover:bg-gray-600 transition-all duration-200 shadow-lg border ${selectedSavedDashboardId === dashboard.id ? 'border-green-400' : 'border-gray-500'}`}
                                >
                                    <h3 className="text-xl font-semibold text-white mb-2 truncate">
                                        Dashboard from {dashboard.datasetMetadata?.name || 'Unknown Dataset'}
                                    </h3>
                                    <p className="text-sm text-gray-400 mb-2">
                                        Charts: <span className="text-white">{dashboard.dashboardConfig?.charts?.length || 0}</span>
                                    </p>
                                    <p className="text-sm text-gray-400 mb-2">
                                        Tables: <span className="text-white">{dashboard.dashboardConfig?.tables?.length || 0}</span>
                                    </p>
                                    <p className="text-sm text-gray-400 mb-2">
                                        Metrics: <span className="text-white">{dashboard.dashboardConfig?.metrics?.length || 0}</span>
                                    </p>
                                    <p className="text-sm text-gray-400 mb-2">
                                        Created: <span className="text-white">{dashboard.timestamp ? new Date(dashboard.timestamp.toDate()).toLocaleString() : 'N/A'}</span>
                                    </p>
                                    <p className="text-sm text-blue-300 mt-2">
                                        Click to load this dashboard
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
