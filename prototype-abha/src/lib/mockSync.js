/**
 * The Ghost Stream: Mock-Sync Architecture
 * Simulates high-speed, weightless medical record ingestion.
 */
export const mockFetch = async () => {
  // 0.5s artificial delay for simulation
  await new Promise(resolve => setTimeout(resolve, 500));

  // 90% success rate simulation
  if (Math.random() < 0.1) {
    throw new Error("Handshake failed: Gravity-Shake detected.");
  }

  // Pydantic-style structured mock response
  return {
    abha_address: "meet.health@abha",
    full_name: "Meet Ukani",
    blood_group: "O+",
    date_of_birth: "1998-05-15",
    chronic_conditions: ["None", "Peak Athletic Condition"],
    last_vaccination_date: "2024-03-20",
    verified_status: "verified",
    ingestion_at: new Date().toISOString()
  };
};
