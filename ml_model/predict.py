
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from xgboost import XGBClassifier


BASE_DIR = Path(
    __file__
).resolve().parent


MODEL_DIR = (
    BASE_DIR /
    "models"
)


def safe_food_name(food):

    return (

        str(food)
        .strip()
        .replace(" ", "_")
        .replace("/", "_")

    )


def load_model(food):

    food_dir = (

        MODEL_DIR /
        safe_food_name(food)

    )


    if not food_dir.exists():

        raise ValueError(
            f"No model found for food: {food}"
        )


    with open(

        food_dir /
        "metadata.json",

        "r"

    ) as f:

        metadata = json.load(f)


    model = XGBClassifier()


    model.load_model(

        food_dir /
        "classifier.json"

    )


    imputer = joblib.load(

        food_dir /
        "imputer.joblib"

    )


    return (
        model,
        imputer,
        metadata
    )


# =============================================================================
# FEATURE ENGINE
# =============================================================================

def create_features(
    current,
    history=None
):

    if history is None:

        history = []


    rows = []


    for reading in history:

        rows.append({

            "Temperature":
                reading.get(
                    "Temperature",
                    np.nan
                ),

            "Humidity":
                reading.get(
                    "Humidity",
                    np.nan
                ),

            "Methane":
                reading.get(
                    "Methane",
                    np.nan
                ),

            "CO2":
                reading.get(
                    "CO2",
                    np.nan
                ),

            "Storage_Days":
                reading.get(
                    "Storage_Days",
                    np.nan
                ),

            "Timestamp_Hours":
                reading.get(
                    "Timestamp_Hours",
                    np.nan
                )

        })


    rows.append({

        "Temperature":
            current.get(
                "Temperature",
                np.nan
            ),

        "Humidity":
            current.get(
                "Humidity",
                np.nan
            ),

        "Methane":
            current.get(
                "Methane",
                np.nan
            ),

        "CO2":
            current.get(
                "CO2",
                np.nan
            ),

        "Storage_Days":
            current.get(
                "Storage_Days",
                np.nan
            ),

        "Timestamp_Hours":
            current.get(
                "Timestamp_Hours",
                np.nan
            )

    })


    h = pd.DataFrame(
        rows
    )


    for c in [

        "Temperature",
        "Humidity",
        "Methane",
        "CO2",
        "Storage_Days",
        "Timestamp_Hours"

    ]:

        h[c] = pd.to_numeric(
            h[c],
            errors="coerce"
        )


    if h["Timestamp_Hours"].notna().sum() >= 2:

        h = (

            h

            .sort_values(
                "Timestamp_Hours"
            )

            .reset_index(
                drop=True
            )

        )


    r = h.iloc[-1]

    f = {}


    # Raw

    for c in [

        "Temperature",
        "Humidity",
        "Methane",
        "CO2",
        "Storage_Days"

    ]:

        f[c] = r[c]

        f[
            f"{c}_Missing"
        ] = int(
            pd.isna(r[c])
        )

        f[
            f"{c}_sq"
        ] = r[c] ** 2

        f[
            f"{c}_cube"
        ] = r[c] ** 3

        f[
            f"{c}_abs"
        ] = abs(r[c])

        f[
            f"{c}_sqrt"
        ] = np.sqrt(
            abs(r[c])
        )

        f[
            f"{c}_log"
        ] = np.log1p(
            abs(r[c])
        )


    # Pairwise

    pairs = [

        ("Temperature", "Humidity"),

        ("Temperature", "Methane"),

        ("Temperature", "CO2"),

        ("Humidity", "Methane"),

        ("Humidity", "CO2"),

        ("Methane", "CO2")

    ]


    for a, b in pairs:

        f[f"{a}_x_{b}"] = (
            r[a] * r[b]
        )

        f[f"{a}_plus_{b}"] = (
            r[a] + r[b]
        )

        f[f"{a}_minus_{b}"] = (
            r[a] - r[b]
        )

        f[f"{a}_ratio_{b}"] = (
            r[a] /
            (abs(r[b]) + 1e-6)
        )


    # Gas

    methane = r["Methane"]

    co2 = r["CO2"]

    temperature = r["Temperature"]

    humidity = r["Humidity"]

    storage = r["Storage_Days"]


    f["Total_Gas"] = (
        methane + co2
    )

    f["Gas_Product"] = (
        methane * co2
    )

    f["Gas_Magnitude"] = np.sqrt(
        methane ** 2 +
        co2 ** 2
    )

    f["Gas_Squared_Load"] = (
        methane ** 2 +
        co2 ** 2
    )

    f["Methane_to_CO2"] = (
        methane /
        (abs(co2) + 1e-6)
    )

    f["CO2_to_Methane"] = (
        co2 /
        (abs(methane) + 1e-6)
    )


    # Environmental

    f[
        "Temperature_Humidity_Load"
    ] = (
        temperature *
        humidity
    )

    f[
        "Temperature_Total_Gas_Load"
    ] = (
        temperature *
        f["Total_Gas"]
    )

    f[
        "Humidity_Total_Gas_Load"
    ] = (
        humidity *
        f["Total_Gas"]
    )


    # Three-way

    f[
        "Temperature_Humidity_Methane"
    ] = (
        temperature *
        humidity *
        methane
    )

    f[
        "Temperature_Humidity_CO2"
    ] = (
        temperature *
        humidity *
        co2
    )

    f[
        "Temperature_Methane_CO2"
    ] = (
        temperature *
        methane *
        co2
    )

    f[
        "Humidity_Methane_CO2"
    ] = (
        humidity *
        methane *
        co2
    )


    # Storage

    for c in [

        "Temperature",
        "Humidity",
        "Methane",
        "CO2"

    ]:

        value = r[c]

        f[
            f"Storage_x_{c}"
        ] = storage * value

        f[
            f"Storage_x_{c}_sq"
        ] = (
            storage *
            value ** 2
        )

        f[
            f"Storage_sq_x_{c}"
        ] = (
            storage ** 2 *
            value
        )


    f[
        "Storage_Temperature_Humidity"
    ] = (
        storage *
        temperature *
        humidity
    )

    f[
        "Storage_Total_Gas"
    ] = (
        storage *
        f["Total_Gas"]
    )

    f[
        "Storage_Temperature_Gas"
    ] = (
        storage *
        temperature *
        f["Total_Gas"]
    )

    f[
        "Environmental_Gas_Load"
    ] = (
        temperature *
        humidity *
        f["Total_Gas"]
    )

    f[
        "Storage_Environmental_Load"
    ] = (
        storage *
        temperature *
        humidity *
        f["Total_Gas"]
    )


    # History

    f[
        "History_Length"
    ] = len(h)


    sensors = [

        "Temperature",
        "Humidity",
        "Methane",
        "CO2"

    ]


    # Delta/rate

    if len(h) >= 2:

        previous = h.iloc[-2]


        for c in sensors:

            f[
                f"{c}_Delta"
            ] = (
                r[c] -
                previous[c]
            )


        if (

            pd.notna(
                r["Timestamp_Hours"]
            )

            and

            pd.notna(
                previous[
                    "Timestamp_Hours"
                ]
            )

        ):

            dt = (
                r["Timestamp_Hours"]
                -
                previous["Timestamp_Hours"]
            )

        else:

            dt = 1.0


        dt = max(
            abs(dt),
            1e-6
        )


        f[
            "Time_Delta_Hours"
        ] = dt


        for c in sensors:

            f[
                f"{c}_Rate"
            ] = (
                f[f"{c}_Delta"] /
                dt
            )


    else:

        f[
            "Time_Delta_Hours"
        ] = 0.0


        for c in sensors:

            f[
                f"{c}_Delta"
            ] = 0.0

            f[
                f"{c}_Rate"
            ] = 0.0


    # Acceleration

    if len(h) >= 3:

        r1 = h.iloc[-3]

        r2 = h.iloc[-2]

        r3 = h.iloc[-1]


        for c in sensors:

            d1 = (
                r2[c] -
                r1[c]
            )

            d2 = (
                r3[c] -
                r2[c]
            )

            f[
                f"{c}_Acceleration"
            ] = d2 - d1


    else:

        for c in sensors:

            f[
                f"{c}_Acceleration"
            ] = 0.0


    # Rolling

    for window in [

        3,
        5,
        10

    ]:

        w = h.tail(
            window
        )


        for c in sensors:

            f[
                f"{c}_RollingMean_{window}"
            ] = w[c].mean()

            f[
                f"{c}_RollingStd_{window}"
            ] = w[c].std()

            f[
                f"{c}_RollingMin_{window}"
            ] = w[c].min()

            f[
                f"{c}_RollingMax_{window}"
            ] = w[c].max()

            f[
                f"{c}_RollingRange_{window}"
            ] = (
                w[c].max()
                -
                w[c].min()
            )


    # Cumulative / EWMA

    for c in sensors:

        f[
            f"{c}_CumulativeMean"
        ] = h[c].mean()

        f[
            f"{c}_CumulativeStd"
        ] = h[c].std()

        f[
            f"{c}_CumulativeMin"
        ] = h[c].min()

        f[
            f"{c}_CumulativeMax"
        ] = h[c].max()

        f[
            f"{c}_CumulativeRange"
        ] = (
            h[c].max()
            -
            h[c].min()
        )

        f[
            f"{c}_EWMA"
        ] = (
            h[c]
            .ewm(
                span=5,
                adjust=False
            )
            .mean()
            .iloc[-1]
        )


    # Gas history

    gas = (
        h["Methane"]
        +
        h["CO2"]
    )


    f[
        "Cumulative_Gas_Mean"
    ] = gas.mean()

    f[
        "Cumulative_Gas_Max"
    ] = gas.max()

    f[
        "Cumulative_Gas_Range"
    ] = (
        gas.max()
        -
        gas.min()
    )


    # Baseline

    if len(h) >= 2:

        for c in sensors:

            baseline = h[c].iloc[0]

            f[
                f"{c}_BaselineDeviation"
            ] = (
                r[c] -
                baseline
            )

            f[
                f"{c}_BaselineDeviationPct"
            ] = (
                (
                    r[c] -
                    baseline
                )
                /
                (
                    abs(baseline)
                    +
                    1e-6
                )
            )


    else:

        for c in sensors:

            f[
                f"{c}_BaselineDeviation"
            ] = 0.0

            f[
                f"{c}_BaselineDeviationPct"
            ] = 0.0


    # Temporal interactions

    f[
        "MethaneRate_x_CO2Rate"
    ] = (
        f["Methane_Rate"]
        *
        f["CO2_Rate"]
    )

    f[
        "TemperatureRate_x_HumidityRate"
    ] = (
        f["Temperature_Rate"]
        *
        f["Humidity_Rate"]
    )

    f[
        "TemperatureRate_x_GasRate"
    ] = (
        f["Temperature_Rate"]
        *
        (
            f["Methane_Rate"]
            +
            f["CO2_Rate"]
        )
    )


    return pd.DataFrame([f])


# =============================================================================
# RUL
# =============================================================================

def estimate_rul(
    storage_days,
    probabilities,
    metadata
):

    if storage_days is None:

        return None


    try:

        storage_days = float(
            storage_days
        )

    except Exception:

        return None


    max_storage = metadata.get(
        "max_training_storage_days"
    )

    if max_storage is None:

        max_storage = metadata.get(
            "max_training_storage_days",
            metadata.get(
                "max_training_storage_days"
            )
        )


    if max_storage is None:

        return None


    p0 = float(
        probabilities[0]
    )

    p1 = float(
        probabilities[1]
    )

    p2 = float(
        probabilities[2]
    )


    severity = (

        0.0 * p0
        +
        0.5 * p1
        +
        1.0 * p2

    )


    remaining = (

        max_storage -
        storage_days

    )


    rul = (

        remaining
        *
        (
            1.0 -
            0.75 * severity
        )

    )


    return float(
        max(
            0.0,
            rul
        )
    )


# =============================================================================
# RISK
# =============================================================================

def calculate_risk(
    probabilities,
    rul
):

    p0 = float(
        probabilities[0]
    )

    p1 = float(
        probabilities[1]
    )

    p2 = float(
        probabilities[2]
    )


    severity = (

        0.0 * p0
        +
        0.5 * p1
        +
        1.0 * p2

    )


    if rul is None:

        rul_component = 0.0

    elif rul <= 1:

        rul_component = 1.0

    elif rul <= 2:

        rul_component = 0.7

    elif rul <= 3:

        rul_component = 0.5

    else:

        rul_component = 0.2


    risk_score = (

        80.0 * severity
        +
        20.0 * rul_component

    )


    risk_score = float(
        np.clip(
            risk_score,
            0,
            100
        )
    )


    if risk_score >= 75:

        category = "CRITICAL"

    elif risk_score >= 50:

        category = "HIGH"

    elif risk_score >= 25:

        category = "MEDIUM"

    else:

        category = "LOW"


    return (
        risk_score,
        category
    )


# =============================================================================
# PREDICTION
# =============================================================================

def predict_from_sensor_payload(
    payload
):

    if not isinstance(
        payload,
        dict
    ):

        raise ValueError(
            "Payload must be a JSON object."
        )


    food = payload.get(
        "Food_Name"
    )


    history = payload.get(
        "History",
        []
    )


    batch_id = payload.get(
        "Batch_ID",
        "UNKNOWN"
    )


    if not food:

        raise ValueError(
            "Food_Name is required."
        )


    if not isinstance(
        history,
        list
    ):

        raise ValueError(
            "History must be a list."
        )


    if len(history) == 0:

        raise ValueError(
            "History cannot be empty."
        )


    current = history[-1]


    model, imputer, metadata = (

        load_model(
            food
        )

    )


    feature_row = create_features(

        current=current,

        history=history

    )


    expected_features = (

        metadata[
            "feature_names"
        ]

    )


    # Force exact schema

    for feature in expected_features:

        if feature not in feature_row.columns:

            feature_row[
                feature
            ] = np.nan


    feature_row = feature_row[
        expected_features
    ]


    processed = imputer.transform(
        feature_row
    )


    probabilities = (

        model

        .predict_proba(
            processed
        )

        [0]

    )


    predicted_class = int(

        np.argmax(
            probabilities
        )

    )


    rul = estimate_rul(

        current.get(
            "Storage_Days"
        ),

        probabilities,

        metadata

    )


    risk_score, risk_category = (

        calculate_risk(

            probabilities,

            rul

        )

    )


    reasons = []


    if probabilities[2] >= 0.50:

        reasons.append(
            "The food-specific model assigns high probability to advanced spoilage."
        )

    elif probabilities[1] >= 0.50:

        reasons.append(
            "The food-specific model assigns significant probability to the intermediate spoilage state."
        )

    else:

        reasons.append(
            "The food-specific model currently favors the fresh state."
        )


    if len(history) >= 2:

        if (

            feature_row.iloc[0][
                "Temperature_Rate"
            ]

            > 0

        ):

            reasons.append(
                "Temperature is increasing across the observed history."
            )


        if (

            feature_row.iloc[0][
                "Methane_Rate"
            ]

            > 0

        ):

            reasons.append(
                "Methane is increasing across the observed history."
            )


        if (

            feature_row.iloc[0][
                "CO2_Rate"
            ]

            > 0

        ):

            reasons.append(
                "CO2 is increasing across the observed history."
            )


    if (

        rul is not None
        and
        rul <= 1

    ):

        reasons.append(
            "Estimated remaining shelf life is approximately one day or less."
        )


    return {

        "status":
            "OK",

        "Food_Name":
            food,

        "Batch_ID":
            batch_id,

        "Current_Reading":
            len(history),

        "History_Used":
            len(history),

        "Feature_Count":
            len(expected_features),

        "Spoilage_State":
            predicted_class,

        "Spoilage_Probabilities": {

            "Fresh":
                round(
                    float(probabilities[0]),
                    6
                ),

            "Intermediate":
                round(
                    float(probabilities[1]),
                    6
                ),

            "Advanced":
                round(
                    float(probabilities[2]),
                    6
                )

        },

        "Estimated_RUL_Days":
            None
            if rul is None
            else round(
                rul,
                4
            ),

        "Risk_Score":
            round(
                risk_score,
                4
            ),

        "Risk_Category":
            risk_category,

        "Risk_Reasons":
            reasons,

        "Model":
            "Food-specific XGBoost",

        "Features":
            len(expected_features),

        "History_Enabled":
            True,

        "Threshold_Driven":
            False,

        "RUL_Type":
            "Dataset-derived estimate"

    }
