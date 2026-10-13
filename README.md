# 🚀 FBDock — Facebook Video Downloader Online

<p align="center">
  <img src="img/logo-facebook-video-downloader.png" alt="FBDock Logo" width="220" />
</p>

<p align="center">
  <strong>Fast, Modern & Clean Facebook Video Downloader</strong><br>
  ফেসবুকের যেকোনো পাবলিক ভিডিও ও রিলস (Reels) সহজে HD এবং SD কোয়ালিটিতে ডাউনলোড করার একটি চমৎকার ওয়েব অ্যাপ্লিকেশন।
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/Engine-Vanilla%20JS%20%2B%20HTML5-blue.svg" alt="Frontend" />
  <img src="https://img.shields.io/badge/Downscaling-FFmpeg%20Static-red.svg" alt="FFmpeg" />
  <img src="https://img.shields.io/badge/Speed-Instant%201--Click-brightgreen.svg" alt="Speed" />
  <img src="https://img.shields.io/badge/License-ISC-orange.svg" alt="License" />
</p>

---

## 📖 প্রজেক্ট পরিচিতি (About The Project)

**FBDock** হলো একটি হাই-স্পিড অনলাইন ফেসবুক ভিডিও ডাউনলোডার। কোনো প্রকার বিরক্তিকর পপ-আপ অ্যাড বা রিডাইরেক্ট ছাড়াই ব্যবহারকারীরা সরাসরি এক ক্লিকে ফেসবুক ভিডিও এবং রিলস ডাউনলোড করতে পারেন।

প্রজেক্টটি এমনভাবে তৈরি করা হয়েছে যাতে মোবাইল, ট্যাবলেট বা ডেস্কটপ—যেকোনো ডিভাইসে ইউজার ফ্রেন্ডলি অভিজ্ঞতা পাওয়া যায়।

---

## ✨ মূল ফিচারসমূহ (Key Features)

### 🎬 ১. ট্রু ডুয়াল রেজোলিউশন (HD & SD Quality)
- **HD Quality:** ফেসবুকের আসল সর্বোচ্চ রেজোলিউশনে (720p / 1080p) ভিডিও ডাউনলোড হয়।
- **Normal Quality (SD):** কম ডেটা খরচে হালকা সাইজের (360p / 480p) ভিডিও ডাউনলোড হয়। যদি কোনো ভিডিওতে আপস্ট্রিমে একটাই রেজোলিউশন থাকে, তাহলে ব্যাকএন্ডের **FFmpeg ইঞ্জিন** স্বয়ংক্রিয়ভাবে ভিডিওকে 480p-তে ডাউনস্কেল করে ছোট সাইজে ডেলিভার করে।

### 🏷️ ২. সঠিক নামে অটো-সেভ (Smart Filename)
- ভিডিওটির আসল ফেসবুক ক্যাপশন ও নাম অনুযায়ী ফাইল সেভ হয় (যেমন: `ভিডিওর নাম_HD.mp4` অথবা `ভিডিওর নাম_SD.mp4`)।
- উইন্ডোজ এবং মোবাইল ফ্রেন্ডলি ক্যারেক্টার ক্লিনিং থাকায় কোনো ফাইলে ইনভ্যালিড চিহ্ন থাকে না।

### ⚡ ৩. এক ক্লিকে ইনস্ট্যান্ট ডাউনলোড (Zero Reload / No Blank Tabs)
- কোনো ব্ল্যাঙ্ক পেজ বা নতুন ট্যাব খোলে না।
- ক্রোম, এজ, সাফারি ব্রাউজার ডাউনলোডারের পাশাপাশি **IDM (Internet Download Manager)** দিয়ে সরাসরি ডাউনলোড সাপোর্ট করে।
- ১ ক্লিকে ঠিক ১টি ফাইলই ডাউনলোড হবে (কোনো ডুপ্লিকেট ডাউনলোড নেই)।

### 📱 ৪. রেসপনসিভ ও প্রিমিয়াম ডিজাইন
- আধুনিক কার্ড লেআউট ও থাম্বনেইল প্রিভিউ।
- "How to Use" ইন্টারেক্টিভ গাইড (PC/Mac এবং iPhone/iPad এর জন্য আলাদা স্টেপ-বাই-স্টেপ টিউটোরিয়াল)।
- ফাস্ট সার্চ ও প্রসেসিং প্রগ্রেসবার।

---

## 🛠️ ব্যবহৃত টেকনোলজি (Tech Stack)

| পার্ট | টেকনোলজি | ব্যবহার |
|---|---|---|
| **Backend** | Node.js (HTTP / Stream API) | হাই-স্পিড স্ট্রিমিং ও প্রক্সি সার্ভার |
| **Video Engine** | FFmpeg (`ffmpeg-static`) | রিয়েল-টাইম 480p SD ভিডিও ডাউনস্কেলিং |
| **Scraper & API** | `rahad-all-downloader-v2` & `snapsave` | ফেসবুক ভিডিও লিংক ও মেটাডাটা এক্সট্র্যাকশন |
| **Frontend** | Vanilla JavaScript & HTML5 | সুপার ফাস্ট ও লাইটওয়েট ক্লায়েন্ট |
| **Styling** | Custom Vanilla CSS & Bootstrap Grid | মোবাইল ও ডেস্কটপ রেসপনসিভ UI |

---

## 🚀 লোকাল মেশিনে চালানোর নিয়ম (Getting Started)

### পূর্বশর্ত (Prerequisites):
আপনার কম্পিউটারে [Node.js](https://nodejs.org/) (ভার্সন 18 বা তার বেশি) ইনস্টল থাকতে হবে।

### ধাপ ১: ডিপেন্ডেন্সি ইনস্টল করুন
প্রজেক্ট ফোল্ডারে টার্মিনাল ওপেন করে নিচের কমান্ডটি চালান:
```bash
npm install
```

### ধাপ ২: সার্ভার চালু করুন
```bash
npm start
```

### ধাপ ৩: ব্রাউজারে ওপেন করুন
আপনার পছন্দের ব্রাউজারে গিয়ে ভিজিট করুন:
```text
http://localhost:3000
```

---

## 📁 ফাইল স্ট্রাকচার (Project Structure)

```text
FB/
├── api/
│   ├── download.js         # ভিডিও মেটাডাটা ও মাল্টি-ইঞ্জিন এক্সট্র্যাক্টর
│   └── contact.js          # কন্টাক্ট ও সাপোর্ট হ্যান্ডলার
├── css/
│   └── style.css           # মূল কাস্টম স্টাইল ও রেসপনসিভ ডিজাইন
├── js/
│   ├── downloader.js       # ফ্রন্টএন্ড ডাউনলোড ও UI কন্ট্রোলার
│   ├── scripts.js          # হেল্পার স্ক্রিপ্ট
│   └── bootstrap.min.js    # বুটস্ট্র্যাপ UI লাইব্রেরি
├── img/                    # লোগো, আইকন ও স্টেপ গাইড স্ক্রিনশট
├── index.html              # প্রধান ল্যান্ডিং পেজ (FBDock UI)
├── server.js               # মূল Node.js ব্যাকএন্ড ও FFmpeg স্ট্রিমিং সার্ভার
├── package.json            # ডিপেন্ডেন্সি ও প্রজেক্ট কনফিগ
└── README.md               # প্রজেক্ট ডকুমেন্টেশন
```

---

## 🔒 প্রাইভেসি ও ডিসক্লেইমার (Privacy & Disclaimer)

> **নোট:** FBDock সার্ভারে কোনো ভিডিও ফাইল জমা বা সংরক্ষণ (Store/Host) করে না। সমস্ত মিডিয়া ফাইল সরাসরি ফেসবুকের পাবলিক কনটেন্ট ডেলিভারি নেটওয়ার্ক (CDN) থেকে রিয়েল-টাইম প্রক্সি স্ট্রিমের মাধ্যমে ইউজারদের কাছে পৌঁছায়। এটি শুধুমাত্র ব্যক্তিগত ও শিক্ষামূলক ব্যবহারের জন্য তৈরি।

---

## 👨‍💻 অবদান ও ক্রেডিট (Credits)
Developed with ❤️ by **Saifulla Tanim**.
All rights reserved © FBDock.
