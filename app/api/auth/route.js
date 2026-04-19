import { cookies } from "next/headers";
import { createHash } from "node:crypto";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    const loginResponse = await fetch("https://api-eu.libreview.io/llu/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        product: "llu.android",
        version: "4.16.0",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      return Response.json({ error: "Login failed", details: errorData }, { status: loginResponse.status });
    }

    const loginResult = await loginResponse.json();
    console.log(`[DEBUG] Login Status: ${loginResult.status}`);
    
    if (loginResult.status !== 0) {
      return Response.json({ error: "Login status not SUCCESS", details: loginResult }, { status: 401 });
    }

    const token = loginResult.data.authTicket.token;
    const accountId = loginResult.data.user.id;
    const accountIdHash = createHash("sha256").update(accountId).digest("hex");
    let connectionId = loginResult.data.connection?.id; // Try to get the patient's own ID if it exists

    console.log(`[DEBUG] Login successful. UserID: ${accountId}, Initial ConnectionID: ${connectionId}`);

    // If no direct connection ID, get connections list to find others
    const connectionsResponse = await fetch("https://api-eu.libreview.io/llu/connections", {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "Account-Id": accountIdHash,
        product: "llu.android",
        version: "4.16.0",
      },
    });

    if (connectionsResponse.ok) {
      const connectionsResult = await connectionsResponse.json();
      console.log(`[DEBUG] Found ${connectionsResult.data?.length || 0} connections`);
      
      if (!connectionId && connectionsResult.data && connectionsResult.data.length > 0) {
        // Use the first active connection (patientId or patient's own UI name)
        connectionId = connectionsResult.data[0].patientId;
        console.log(`[DEBUG] Selected ConnectionID from list: ${connectionId}`);
      }
    } else {
      console.warn(`[DEBUG] Failed to list connections: status ${connectionsResponse.status}`);
    }

    const cookieStore = await cookies();
    cookieStore.set("libre_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    
    // Store accountId and connectionId in cookies too for the API route to use
    if (accountId) {
      cookieStore.set("libre_account_id", accountId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }
    
    if (connectionId) {
      cookieStore.set("libre_connection_id", connectionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    return Response.json({ success: true, accountId, connectionId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
