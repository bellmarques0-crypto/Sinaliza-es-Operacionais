import { isSupervisorMatch } from '../src/utils/dateUtils.js';

function runTests() {
  console.log('--- TESTING RODRIGO & LARISSA CROSS ACCESS ---');

  const t1 = isSupervisorMatch('RODRIGO BUENO', 'rodrigo.bueno', 'LARISSA MICHAELY RIBEIRO');
  console.log('1. Rodrigo user vs Larissa supervisor:', t1 ? '✅ PASS' : '❌ FAIL');

  const t2 = isSupervisorMatch('LARISSA MICHAELY RIBEIRO', 'larissa.michaely', 'RODRIGO BUENO SILVA');
  console.log('2. Larissa user vs Rodrigo supervisor:', t2 ? '✅ PASS' : '❌ FAIL');

  const t3 = isSupervisorMatch('LARISSA MICHAELY RIBEIRO', 'larissa.michaely', 'LARISSA MICHAELY RIBEIRO');
  console.log('3. Larissa user vs Larissa supervisor:', t3 ? '✅ PASS' : '❌ FAIL');

  const t4 = isSupervisorMatch('RODRIGO BUENO SILVA', 'rodrigo.bueno', 'RODRIGO BUENO SILVA');
  console.log('4. Rodrigo user vs Rodrigo supervisor:', t4 ? '✅ PASS' : '❌ FAIL');

  const t5 = isSupervisorMatch('VITORIA MARQUES CUNHA', 'vitoria.cunha', 'RODRIGO BUENO SILVA');
  console.log('5. Vitoria user vs Rodrigo supervisor:', !t5 ? '✅ PASS (Correctly blocked)' : '❌ FAIL');

  const t6 = isSupervisorMatch('VITORIA MARQUES CUNHA', 'vitoria.cunha', 'CAMILY VITORIA SALES MARQUES');
  console.log('6. Vitoria user vs Camily Vitoria supervisor:', !t6 ? '✅ PASS (Correctly blocked)' : '❌ FAIL');

  if (t1 && t2 && t3 && t4 && !t5 && !t6) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME TESTS FAILED!');
    process.exit(1);
  }
}

runTests();
