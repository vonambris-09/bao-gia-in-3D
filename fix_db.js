import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const settingsSnap = await getDocs(collection(db, 'settings'));
    let newUid = null;
    if (!settingsSnap.empty) {
      newUid = settingsSnap.docs[0].id;
      console.log('Found New UID from settings:', newUid);
    }

    const materialsSnap = await getDocs(collection(db, 'materials'));
    console.log(`Found ${materialsSnap.size} materials total.`);

    let counts = 0;

    if (!newUid && materialsSnap.size > 0) {
       console.log("No new UID found in settings. Examining materials to find the odd one out (recently added).");
       const uidCounts = {};
       materialsSnap.docs.forEach(d => {
         const o = d.data().ownerId;
         uidCounts[o] = (uidCounts[o] || 0) + 1;
       });
       console.log("UID distribution:", uidCounts);
       
       const uids = Object.keys(uidCounts);
       if (uids.length > 1) {
         uids.sort((a,b) => uidCounts[a] - uidCounts[b]);
         newUid = uids[0]; 
         console.log('Determined New UID:', newUid);
       } else {
         newUid = uids[0];
       }
    }

    if (newUid) {
      for (const d of materialsSnap.docs) {
        const data = d.data();
        if (data.ownerId !== newUid) {
          await setDoc(doc(db, 'materials', d.id), { ownerId: newUid }, { merge: true });
          counts++;
        }
      }
    }

    console.log(`Successfully migrated ${counts} documents to ${newUid}.`);
    process.exit(0);
  } catch (e) {
    console.error("Migration failed", e);
    process.exit(1);
  }
}
run();
