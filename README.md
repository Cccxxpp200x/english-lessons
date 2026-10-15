# เรียนภาษาอังกฤษ (English Lessons)

เว็บฝึกคำศัพท์ภาษาอังกฤษสำหรับคนไทย มีแฟลชการ์ดและแบบทดสอบปรนัย
ใช้ GitHub เก็บเนื้อหาบทเรียน และเปิดเว็บผ่าน GitHub Pages

**เว็บไซต์:** https://cccxxpp200x.github.io/english-lessons/

## โครงสร้าง

```
index.html          หน้าแรก (รายการบทเรียน)
lesson.html         หน้าเรียน: แฟลชการ์ด / แบบทดสอบ
assets/style.css    หน้าตาเว็บ
assets/app.js       โค้ดโหลดข้อมูลและแสดงผล
data/index.json     สารบัญบทเรียน
data/lessons/       ไฟล์บทเรียนแต่ละบท
data/SCHEMA.md      รูปแบบข้อมูลและวิธีเพิ่มบทเรียน
```

คะแนนดีที่สุดของผู้เรียนเก็บไว้ในเบราว์เซอร์ของผู้เรียนเอง (localStorage) ไม่ได้ส่งขึ้น GitHub

## เปิดบนเครื่อง

ต้องเปิดผ่านเว็บเซิร์ฟเวอร์ (ดับเบิลคลิกไฟล์ HTML ตรงๆ จะโหลดข้อมูล JSON ไม่ได้)

```bash
python -m http.server 8000
```

แล้วเปิด http://localhost:8000

## เพิ่มบทเรียน

ดู [data/SCHEMA.md](data/SCHEMA.md)

## อัปเดตขึ้น GitHub

```bash
git add .
git commit -m "เพิ่มบทเรียน ..."
git push
```
