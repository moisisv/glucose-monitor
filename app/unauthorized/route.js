import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Route Handler to force logout the user by deleting all session cookies
 * and redirecting back to the home page.
 */
export async function GET() {
  const cookieStore = await cookies();
  
  // Clear all session identifiers
  cookieStore.delete("libre_token");
  cookieStore.delete("libre_account_id");
  cookieStore.delete("libre_connection_id");
  
  // Redirect to home where the user will be prompted to log in again
  redirect("/");
}
