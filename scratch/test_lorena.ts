import { isSupervisorMatch } from '../src/utils/dateUtils.js';

function runLorenaTests() {
  console.log('--- TESTING LORENA ACCESS TO CAMILY & ALAIDE ---');

  const t1 = isSupervisorMatch('LORENA SILVA', 'lorena.silva', 'CAMILY VITORIA SALES MARQUES');
  console.log('1. Lorena user vs Camily supervisor:', t1 ? '✅ PASS' : '❌ FAIL');

  const t2 = isSupervisorMatch('LORENA SILVA', 'lorena.silva', 'ALAIDE SANTOS');
  console.log('2. Lorena user vs Alaide supervisor:', t2 ? '✅ PASS' : '❌ FAIL');

  const t3 = isSupervisorMatch('LORENA SILVA', 'lorena.silva', 'ALAÍDE SILVA');
  console.log('3. Lorena user vs Alaíde (with accent) supervisor:', t3 ? '✅ PASS' : '❌ FAIL');

  const t4 = isSupervisorMatch('LORENA SILVA', 'lorena.silva', 'LORENA SILVA');
  console.log('4. Lorena user vs Lorena supervisor:', t4 ? '✅ PASS' : '❌ FAIL');

  const t5 = isSupervisorMatch('LORENA SILVA', 'lorena.silva', 'VITORIA MARQUES CUNHA');
  console.log('5. Lorena user vs Vitoria supervisor:', !t5 ? '✅ PASS (Correctly blocked)' : '❌ FAIL');

  const t6 = isSupervisorMatch('CAMILY VITORIA SALES MARQUES', 'camily.vitoria', 'LORENA SILVA');
  console.log('6. Camily user vs Lorena supervisor:', !t6 ? '✅ PASS (Correctly blocked)' : '❌ FAIL');

  if (t1 && t2 && t3 && t4 && !t5 && !t6) {
    console.log('🎉 ALL LORENA ACCESS TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME LORENA TESTS FAILED!');
    process.exit(1);
  }
}

runLorenaTests();
