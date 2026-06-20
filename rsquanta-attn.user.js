// ==UserScript==
// @name         ดึง attendance → salaryot
// @namespace    salaryot
// @version      1.0
// @description  แปะปุ่มลอยบนหน้า attendance ของ rsquanta เพื่อคัดลอกตาราง #gvAttn ไปวางใน salaryot / Floating button on the rsquanta attendance page that copies the #gvAttn table for pasting into salaryot.
// @match        https://hr.rsquanta.com/HROldPages/Attn/Modify_Attandence_assistant_min.aspx*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  var msgEl;

  // เด้งข้อความสั้น ๆ เหนือปุ่ม (auto-hide). A small toast above the button.
  function flash(text) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.opacity = '1';
    setTimeout(function () { msgEl.style.opacity = '0'; }, 3000);
  }

  // คัดลอกตาราง attendance ไป clipboard. Copy the attendance table to the clipboard.
  // เหมือน bookmarklet ใน salaryot ทุกอย่าง — "โง่" ไว้ก่อน: ดึง #gvAttn ดิบ ๆ
  // แล้วให้ parser ฝั่ง salaryot จัดการ. Stays dumb (raw #gvAttn copy); all parsing
  // lives in salaryot's parseAttendanceHtml.
  function copyAttn() {
    var t = document.getElementById('gvAttn');
    if (!t) { alert('ไม่พบตาราง #gvAttn ในหน้านี้ — รอให้ตารางขึ้นครบก่อนแล้วลองใหม่'); return; }
    // sync ค่า .value ที่ JS ตั้งตอน runtime กลับเข้า attribute ก่อน serialize
    // เพื่อให้ outerHTML จับค่า OT/วันหยุดครบ. Reflect live input values into the
    // value attribute so outerHTML captures OT/holiday (not just placeholders).
    t.querySelectorAll('input').forEach(function (el) {
      try { el.setAttribute('value', el.value); } catch (e) {}
    });
    var html = t.outerHTML, ok = false;
    try { // sync path: อยู่ใน click gesture, ใช้ได้บนเว็บ HTTP intranet
      var a = document.createElement('textarea');
      a.value = html; a.style.position = 'fixed'; a.style.opacity = '0';
      document.body.appendChild(a); a.select();
      ok = document.execCommand('copy');
      document.body.removeChild(a);
    } catch (e) {}
    if (ok) {
      flash('✅ คัดลอกแล้ว — ไปที่ salaryot กดวาง (Ctrl+V)');
    } else if (navigator.clipboard) { // enhancement: secure context
      navigator.clipboard.writeText(html).then(
        function () { flash('✅ คัดลอกแล้ว — ไปที่ salaryot กดวาง'); },
        function () { alert('คัดลอกไม่สำเร็จ'); });
    } else {
      alert('คัดลอกไม่สำเร็จ');
    }
  }

  // แปะปุ่มลอยมุมขวาล่าง. Inject the floating button (bottom-right).
  function addButton() {
    if (document.getElementById('salaryot-btn')) return;
    var wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;' +
      'display:flex;flex-direction:column;align-items:flex-end;gap:6px;' +
      'font-family:Segoe UI,Tahoma,sans-serif';

    msgEl = document.createElement('div');
    msgEl.style.cssText =
      'background:#222;color:#fff;padding:6px 10px;border-radius:6px;' +
      'font-size:13px;opacity:0;transition:opacity .3s;max-width:240px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.3)';

    var btn = document.createElement('button');
    btn.id = 'salaryot-btn';
    btn.type = 'button';
    btn.textContent = '📋 ดึง attendance → salaryot';
    btn.style.cssText =
      'background:#2563eb;color:#fff;border:none;padding:10px 16px;' +
      'border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.3)';
    btn.addEventListener('click', copyAttn);

    wrap.appendChild(msgEl);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
  }

  addButton();
})();
