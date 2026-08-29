"""Authoritative Phase 9.1 feature extraction engine.

This module preserves the exact create_features implementation shipped
with the frozen Phase 9.1 model package.
"""

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
