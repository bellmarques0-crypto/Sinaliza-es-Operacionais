import path from 'path';
import jwt from 'jsonwebtoken';

async function testHttpEndpoints() {
  const rootPath = 'd:/b.i/Documents/GitHub/Sinalizacoes-Operacionais';
  const { default: app } = await import(path.join(rootPath, 'server.ts'));

  const JWT_SECRET = process.env.JWT_SECRET || 'sinalizacoes_secret_key_2026_super_secure';

  // Generate a valid JWT token for supervisor VITORIA MARQUES CUNHA
  const token = jwt.sign(
    { id: 1, nome: 'VITORIA MARQUES CUNHA', login: 'vitoria.cunha', perfil: 'Supervisor' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const server = app.listen(3099, async () => {
    console.log("Test HTTP Server listening on port 3099");

    try {
      console.log("Sending POST /api/absenteismo/batch...");
      const postRes = await fetch('http://localhost:3099/api/absenteismo/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          records: [
            {
              data: '2026-09-10',
              operador: 'IZABELA SILVA BARCELAR',
              supervisor: 'VITORIA MARQUES CUNHA',
              status: 'Falta Justificada',
              observacao: 'Atestado médico entregue via HTTP',
              usuario_registro: 'VITORIA MARQUES CUNHA'
            }
          ]
        })
      });

      console.log("POST Status:", postRes.status);
      const postData = await postRes.json();
      console.log("POST Response:", postData);

      console.log("\nSending GET /api/absenteismo?data=2026-09-10...");
      const getRes = await fetch('http://localhost:3099/api/absenteismo?data=2026-09-10', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log("GET Status:", getRes.status);
      const getData = await getRes.json();
      console.log("GET Response Count:", getData.length);
      console.log("GET Data Snippet:", JSON.stringify(getData, null, 2));

      if (postRes.status === 200 && getRes.status === 200 && Array.isArray(getData) && getData.length > 0) {
        console.log("\n✅ HTTP API ENDPOINTS TEST PASSED PERFECTLY!");
      } else {
        console.error("\n❌ HTTP API TEST FAILED!");
      }
    } catch (err) {
      console.error("HTTP test error:", err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

testHttpEndpoints().catch(console.error);
