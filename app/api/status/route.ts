import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL || "https://xm2jmtrf-8000.inc1.devtunnels.ms";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/status`, {
      method: "GET",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get status from backend" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying status request to backend:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
