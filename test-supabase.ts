import { supabaseAdmin } from "./src/lib/supabase";
async function run() {
  const { data, error } = await supabaseAdmin.from('telegram_queue').select('*').limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
