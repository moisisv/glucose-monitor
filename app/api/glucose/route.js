import { cookies } from "next/headers";
import { createHash } from "node:crypto";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("libre_token")?.value;
    const accountId = cookieStore.get("libre_account_id")?.value;
    const connectionId = cookieStore.get("libre_connection_id")?.value;

    if (!token || (!accountId && !process.env.LIBREVIEW_ACCOUNT_ID_HASH) || (!connectionId && !process.env.LIBREVIEW_CONNECTION_ID)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use hashed ID from session or optional fallback from environment variables
    const finalAccountId = accountId 
      ? createHash("sha256").update(accountId).digest("hex")
      : process.env.LIBREVIEW_ACCOUNT_ID_HASH;
    
    const finalConnectionId = connectionId || process.env.LIBREVIEW_CONNECTION_ID;

    console.log(`[DEBUG] Fetching logbook. Hashed Account: ${finalAccountId}, Connection: ${finalConnectionId}`);

    const response = await fetch(
      `https://api-eu.libreview.io/llu/connections/${finalConnectionId}/graph`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
          "accept-encoding": "gzip",
          "cache-control": "no-cache",
          connection: "Keep-Alive",
          "content-type": "application/json",
          product: "llu.android",
          version: "4.16.0",
          "Account-Id": finalAccountId,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ERROR] API returned ${response.status}: ${errorText}`);
      throw new Error(
        `API returned ${response.status}: ${response.statusText}`
      );
    }

    const result = await response.json();

    // Map and parse timestamps
    const graphData = result.data.graphData.map((item) => {
      const [datePart, timePart, ampm] = item.Timestamp.trim().split(" ");
      const [month, day, year] = datePart.split("/").map(Number);
      let [hour, minute, second] = timePart.split(":").map(Number);

      if (ampm === "PM" && hour !== 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;

      const timestamp = new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      ).getTime();

      return {
        ...item,
        timestamp, // numeric timestamp for chart
        displayTime: new Date(timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        glucose: item.ValueInMgPerDl ?? item.Value,
        color: item.MeasurementColor ?? 1,
      };
    });
    graphData.push({
      ...result.data.connection.glucoseMeasurement,
      // timestamp, // numeric timestamp for chart
      //   displayTime: new Date(timestamp).toLocaleTimeString("en-US", {
      //     hour: "2-digit",
      //     minute: "2-digit",
      //   }),
      //   glucose: item.ValueInMgPerDl ?? item.Value,
      color: (result.data.connection.glucoseMeasurement.ValueInMgPerDl ?? result.data.connection.glucoseMeasurement.Value) < 70 ? 0 : (result.data.connection.glucoseMeasurement.MeasurementColor ?? 1),
    });

    return Response.json(graphData);
  } catch (error) {
    console.error("Error fetching logbook data:", error);
    return Response.json(
      { error: "Failed to fetch logbook data", details: error.message },
      { status: 500 }
    );
  }
}
