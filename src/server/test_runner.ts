import { db } from './db.js';
import { getLocalAbsenteismo } from './localDb.js';

async function main() {
  console.log("--- TEST ABSENTEISMO SAVE & READ ---");

  const testRecords = [
    {
      data: '2026-09-10',
      operador: 'IZABELA SILVA BARCELAR',
      supervisor: 'VITORIA MARQUES CUNHA',
      status: 'Falta Justificada' as const,
      observacao: 'Atestado médico entregue',
      usuario_registro: 'VITORIA MARQUES CUNHA'
    },
    {
      data: '2026-09-10',
      operador: 'ANA CAROLINA FERNANDES MARTINS',
      supervisor: 'VITORIA MARQUES CUNHA',
      status: 'Presente' as const,
      observacao: '',
      usuario_registro: 'VITORIA MARQUES CUNHA'
    }
  ];

  console.log("1. Saving batch records via db.saveAbsenteismoBatch...");
  try {
    const saved = await db.saveAbsenteismoBatch(testRecords, 'VITORIA MARQUES CUNHA');
    console.log("Saved records count:", Array.isArray(saved) ? saved.length : saved);
  } catch (e) {
    console.error("Error saving absenteismo batch:", e);
  }

  console.log("\n2. Fetching records via db.getAbsenteismo('2026-09-10')...");
  try {
    const fetched = await db.getAbsenteismo('2026-09-10');
    console.log("Fetched records count:", fetched.length);
    console.log("Fetched records snippet:", JSON.stringify(fetched.slice(0, 3), null, 2));

    const izabela = fetched.find((r: any) => r.operador.includes('IZABELA'));
    if (izabela && izabela.status === 'Falta Justificada' && izabela.observacao === 'Atestado médico entregue') {
      console.log("\n✅ SUCCESS: Izabela record was saved and retrieved correctly!");
    } else {
      console.error("\n❌ FAIL: Izabela record was not retrieved correctly:", izabela);
    }
  } catch (e) {
    console.error("Error fetching absenteismo:", e);
  }
}

main().then(() => console.log("Test finished.")).catch(console.error);
