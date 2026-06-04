import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsDs_tQemRJwwjH0m8U2YvlqZjWXHEO0k",
  authDomain: "test-school-53999.firebaseapp.com",
  projectId: "test-school-53999",
  storageBucket: "test-school-53999.firebasestorage.app",
  messagingSenderId: "847312056047",
  appId: "1:847312056047:web:44f84a1bb21e49d0b7751a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const todayStr = new Date().toISOString().split('T')[0];
let capturedImageBase64 = null;

// بەڕێوبەرایەتی مۆدالەکان
window.openModal = function(modalId) { document.getElementById(modalId).style.display = "block"; }
window.closeModal = function(modalId) { document.getElementById(modalId).style.display = "none"; }
window.onclick = function(event) { if (event.target.classList.contains('modal')) { event.target.style.display = "none"; } }

// لۆجیکی کارپێکردنی کامێرا و گرتنی وێنە
window.startWebcam = async function() {
    const video = document.getElementById('webcam');
    document.getElementById('btn-take-pic').style.display = 'inline-block';
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.style.display = 'block';
}

window.takeSnapshot = function() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    capturedImageBase64 = canvas.toDataURL('image/jpeg');
    alert('وێنەکە گیرا!');
    video.srcObject.getTracks().forEach(track => track.stop());
    video.style.display = 'none';
}

// ناردن و پاشکەوتکردنی فۆرمی قوتابی نوێ
document.getElementById('student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cardId = document.getElementById('card-id').value;
    const name = document.getElementById('student-name').value;
    const sClass = document.getElementById('student-class').value;
    const fileInput = document.getElementById('student-file');
    
    let finalImageUrl = capturedImageBase64 || "";

    if (!finalImageUrl && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        finalImageUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    await setDoc(doc(db, "students", cardId), {
        cardId, name, class: sClass, imageUrl: finalImageUrl, parentJoined: false, totalAbsences: 0
    }, { merge: true });

    alert("قوتابی بەسەرکەوتوویی پاشکەوتکرا!");
    document.getElementById('student-form').reset();
    capturedImageBase64 = null;
});

// لۆدکردنی زیندووی تەواوی داتاکان لە فایەرستۆر
onSnapshot(collection(db, "students"), (snapshot) => {
    const students = [];
    snapshot.forEach(doc => students.push(doc.data()));
    
    onSnapshot(collection(db, `attendance-${todayStr}`), (attSnapshot) => {
        let attData = {};
        attSnapshot.forEach(d => attData[d.id] = d.data());
        renderAdminDashboard(students, attData);
    });
});

// ڕێندەرکردن و دروستکردنی لیستەکان لەسەر شاشە
function renderAdminDashboard(students, attData) {
    const presentList = document.getElementById('present-list');
    const absentList = document.getElementById('absent-list');
    const monthlyTable = document.getElementById('monthly-report-table-body');
    const allStudentsTable = document.getElementById('all-students-table-body');
    const parentsList = document.getElementById('parents-status-list');

    presentList.innerHTML = ''; absentList.innerHTML = ''; 
    monthlyTable.innerHTML = ''; allStudentsTable.innerHTML = ''; parentsList.innerHTML = '';

    let pCount = 0; let aCount = 0;

    students.forEach(student => {
        const statusObj = attData[student.cardId] || { status: 'absent' };
        const status = statusObj.status;

        let itemClass = '';
        if(status === 'forgot-card') itemClass = 'status-blue';
        if(status === 'leave') itemClass = 'status-leave';

        const li = document.createElement('li');
        li.className = itemClass;
        li.innerHTML = `<span>${student.name} (${student.class})</span>
            <div>
                <button onclick="changeStatus('${student.cardId}', 'present')">هاتوو</button>
                <button onclick="changeStatus('${student.cardId}', 'absent')">نەهاتوو</button>
                <button onclick="changeStatus('${student.cardId}', 'leave')">مۆڵەت</button>
                <button onclick="changeStatus('${student.cardId}', 'forgot-card')">بیرچوون</button>
            </div>`;

        if(status === 'present' || status === 'forgot-card') {
            presentList.appendChild(li); pCount++;
        } else {
            absentList.appendChild(li); aCount++;
        }

        const row = document.createElement('tr');
        row.innerHTML = `<td>${student.cardId}</td><td>${student.name}</td><td>${student.class}</td>
            <td><button style="background:red; color:white;" onclick="deleteAndExportPDF('${student.cardId}')">سڕینەوە و PDF</button></td>`;
        allStudentsTable.appendChild(row);

        if(student.totalAbsences > 0) {
            let colorClass = '';
            if(student.totalAbsences >= 6) colorClass = 'status-red';
            else if(student.totalAbsences >= 4) colorClass = 'status-orange';

            const mRow = document.createElement('tr');
            mRow.className = colorClass;
            mRow.innerHTML = `<td>${student.name}</td><td>${student.class}</td><td>${student.totalAbsences} ڕۆژ</td>`;
            monthlyTable.appendChild(mRow);
        }

        const pLi = document.createElement('li');
        pLi.innerHTML = `<span>👤 ${student.name} (بەخێوکەر): ${student.parentJoined ? '🟢 جۆین بووە' : '🔴 جۆین نەبووە'}</span>`;
        parentsList.appendChild(pLi);
    });

    document.getElementById('today-present-count').innerText = pCount;
    document.getElementById('today-absent-count').innerText = aCount;
}

// گۆڕینی دۆخی ئامادەبوونی قوتابی لە پانێڵەکەوە
window.changeStatus = async function(cardId, newStatus) {
    await setDoc(doc(db, `attendance-${todayStr}`, cardId), { status: newStatus }, { merge: true });
}

// دروستکردنی فایلی PDF پێش سڕینەوەی قوتابی
window.deleteAndExportPDF = async function(cardId) {
    if(confirm("دڵنیای لە سڕینەوەی ئەم قوتابییە؟ پێش سڕینەوە فایلی PDF دروست دەبێت.")) {
        const studentDoc = await getDoc(doc(db, "students", cardId));
        const sData = studentDoc.data();

        const element = document.createElement('div');
        element.style.padding = "20px";
        element.style.fontFamily = "sans-serif";
        element.innerHTML = `<h1>ڕاپۆرتی غایباتی قوتابی: ${sData.name}</h1>
                             <p>پۆل: ${sData.class}</p>
                             <p>کۆ گشتی غایباتی ئەم مانگە: ${sData.totalAbsences} ڕۆژ</p>
                             <p>ڕێکەوتی دەرکردنی ڕاپۆرت: ${new Date().toLocaleDateString()}</p>`;
        
        html2pdf().from(element).save(`${sData.name}_ڕاپۆرت.pdf`);

        await deleteDoc(doc(db, "students", cardId));
        alert("زانیارییەکانی قوتابیەکە سڕایەوە و فایلەکە پاشکەوت بوو.");
    }
}