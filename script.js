"use strict";

const KUNCI_TUGAS = "deadline-radar:tugas:v1";
const MILIDETIK_SEHARI = 86_400_000;
const KESULITAN = { mudah: 1, sedang: 2, sulit: 3 };
const PRIORITAS = [
    { nama: "Tinggi", kelas: "group-high" },
    { nama: "Sedang", kelas: "group-medium" },
    { nama: "Rendah", kelas: "group-low" },
];

const formatHariIni = new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
});
const formatTenggat = new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});

const form = document.querySelector("#form-tugas");
const nama = document.querySelector("#nama-tugas");
const tenggat = document.querySelector("#tanggal-tenggat");
const kesulitan = document.querySelector("#kesulitan");
const judulForm = document.querySelector("#judul-form");
const simpan = document.querySelector("#simpan-tugas");
const batal = document.querySelector("#batal-ubah");
const pesan = document.querySelector("#pesan-form");
const infoPenyimpanan = document.querySelector("#info-penyimpanan");
const daftar = document.querySelector("#daftar-tugas");
const templatBaris = document.querySelector("#baris-tugas");
const tombolAktif = document.querySelector("#lihat-aktif");
const tombolSelesai = document.querySelector("#lihat-selesai");
const tanggalHariIni = document.querySelector("#tanggal-hari-ini");

let tugas = [];
let penyimpananTersedia = true;
let lihatSelesai = false;
let idDisunting = null;
let tanggalTerakhir = "";

function tanggalLokal(waktu = new Date()) {
    const tahun = waktu.getFullYear();
    const bulan = String(waktu.getMonth() + 1).padStart(2, "0");
    const hari = String(waktu.getDate()).padStart(2, "0");
    return [tahun, bulan, hari].join("-");
}

function waktuTenggat(tanggal) {
    return Date.parse(tanggal + "T00:00:00Z");
}

function tenggatValid(tanggal) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        return false;
    }
    const waktu = waktuTenggat(tanggal);
    return Number.isFinite(waktu) && new Date(waktu).toISOString().slice(0, 10) === tanggal;
}

function tugasValid(item) {
    return item !== null && typeof item === "object"
        && typeof item.id === "string"
        && typeof item.nama === "string" && item.nama.trim().length > 0
        && tenggatValid(item.tenggat)
        && Object.hasOwn(KESULITAN, item.kesulitan)
        && typeof item.selesai === "boolean";
}

function pakaiPenyimpananSementara() {
    penyimpananTersedia = false;
    infoPenyimpanan.hidden = false;
}

function bacaTugas() {
    try {
        const data = JSON.parse(localStorage.getItem(KUNCI_TUGAS) ?? "[]");
        if (Array.isArray(data) && data.every(tugasValid)) {
            return data;
        }
    } catch {
        // Daftar masih bisa dipakai selama halaman terbuka.
    }
    pakaiPenyimpananSementara();
    return tugas;
}

function ubahDaftar(perubahan) {
    if (penyimpananTersedia) {
        tugas = bacaTugas();
    }
    tugas = perubahan(tugas);

    if (penyimpananTersedia) {
        try {
            localStorage.setItem(KUNCI_TUGAS, JSON.stringify(tugas));
        } catch {
            pakaiPenyimpananSementara();
        }
    }
    tampilkanDaftar();
}

function prioritasTugas(sisaHari, tingkat) {
    if (sisaHari <= 2 || (sisaHari <= 5 && tingkat === "sulit")) {
        return 0;
    }
    if (sisaHari <= 5 || tingkat === "sulit") {
        return 1;
    }
    return 2;
}

function statusTenggat(sisaHari) {
    if (sisaHari < 0) return "Terlewat " + Math.abs(sisaHari) + " hari";
    if (sisaHari === 0) return "Tenggat hari ini";
    if (sisaHari === 1) return "Tenggat besok";
    return sisaHari + " hari lagi";
}

function buatBaris(item) {
    const baris = templatBaris.content.firstElementChild.cloneNode(true);
    baris.dataset.id = item.id;
    baris.querySelector(".task-name").textContent = item.nama;

    const waktu = baris.querySelector(".task-date");
    waktu.dateTime = item.tenggat;
    waktu.textContent = formatTenggat.format(waktuTenggat(item.tenggat));
    baris.querySelector(".task-difficulty").textContent =
        item.kesulitan[0].toUpperCase() + item.kesulitan.slice(1);

    const status = baris.querySelector(".task-status");
    if (item.selesai) {
        status.textContent = "Selesai";
        status.classList.add("status-done");
    } else {
        status.textContent = statusTenggat(item.sisaHari);
        if (item.sisaHari < 0) {
            status.classList.add("status-late");
        } else if (item.sisaHari <= 2) {
            status.classList.add("status-soon");
        }
    }

    const tombolStatus = baris.querySelector('[data-aksi="selesai"]');
    tombolStatus.textContent = item.selesai ? "Aktifkan lagi" : "Selesai";
    for (const tombol of baris.querySelectorAll("button")) {
        tombol.setAttribute("aria-label", tombol.textContent + " untuk " + item.nama);
    }
    return baris;
}

function buatDaftar(itemTugas) {
    const daftarBaris = document.createElement("ul");
    daftarBaris.className = "task-list";
    for (const item of itemTugas) {
        daftarBaris.append(buatBaris(item));
    }
    return daftarBaris;
}

function tampilkanDaftar() {
    const sekarang = new Date();
    tanggalTerakhir = tanggalLokal(sekarang);
    tanggalHariIni.dateTime = tanggalTerakhir;
    tanggalHariIni.textContent = formatHariIni.format(sekarang);
    const hariIni = waktuTenggat(tanggalTerakhir);

    const terurut = tugas.map(item => {
        const sisaHari = (waktuTenggat(item.tenggat) - hariIni) / MILIDETIK_SEHARI;
        return { ...item, sisaHari, prioritas: prioritasTugas(sisaHari, item.kesulitan) };
    }).sort((a, b) => (
        a.prioritas - b.prioritas
        || a.sisaHari - b.sisaHari
        || KESULITAN[b.kesulitan] - KESULITAN[a.kesulitan]
    ));

    const aktif = terurut.filter(item => !item.selesai);
    const selesai = terurut.filter(item => item.selesai);
    document.querySelector("#jumlah-aktif").textContent = aktif.length;
    document.querySelector("#jumlah-dekat").textContent =
        aktif.filter(item => item.sisaHari >= 0 && item.sisaHari <= 2).length;
    document.querySelector("#jumlah-lewat").textContent =
        aktif.filter(item => item.sisaHari < 0).length;
    document.querySelector("#jumlah-selesai").textContent = selesai.length;

    const terbaik = aktif[0];
    const namaRekomendasi = document.querySelector("#nama-rekomendasi");
    const infoRekomendasi = document.querySelector("#info-rekomendasi");
    if (terbaik) {
        namaRekomendasi.textContent = terbaik.nama;
        infoRekomendasi.textContent = statusTenggat(terbaik.sisaHari)
            + ". Prioritas " + PRIORITAS[terbaik.prioritas].nama.toLowerCase() + ".";
    } else {
        namaRekomendasi.textContent = tugas.length ? "Semua tugas selesai" : "Belum ada tugas";
        infoRekomendasi.textContent = tugas.length
            ? ""
            : "Tambahkan tugas untuk melihat urutannya.";
    }

    tombolAktif.setAttribute("aria-pressed", String(!lihatSelesai));
    tombolSelesai.setAttribute("aria-pressed", String(lihatSelesai));
    daftar.replaceChildren();

    const terlihat = lihatSelesai ? selesai : aktif;
    if (terlihat.length === 0) {
        const kosong = document.createElement("p");
        kosong.className = "empty-tasks";
        kosong.textContent = lihatSelesai ? "Belum ada tugas yang selesai." : "Belum ada tugas aktif.";
        daftar.append(kosong);
        return;
    }
    if (lihatSelesai) {
        daftar.append(buatDaftar(selesai));
        return;
    }

    for (const [peringkat, tingkat] of PRIORITAS.entries()) {
        const kelompok = aktif.filter(item => item.prioritas === peringkat);
        if (kelompok.length === 0) continue;

        const bagian = document.createElement("section");
        bagian.className = "task-group " + tingkat.kelas;
        const judul = document.createElement("h3");
        judul.className = "group-title";
        const titik = document.createElement("span");
        titik.className = "group-dot";
        titik.setAttribute("aria-hidden", "true");
        judul.append(titik, "Prioritas " + tingkat.nama.toLowerCase());
        bagian.append(judul, buatDaftar(kelompok));
        daftar.append(bagian);
    }
}

function resetForm() {
    idDisunting = null;
    form.reset();
    judulForm.textContent = "Tambah tugas";
    simpan.textContent = "Tambah tugas";
    batal.hidden = true;
}

function editTugas(item) {
    idDisunting = item.id;
    nama.value = item.nama;
    tenggat.value = item.tenggat;
    kesulitan.value = item.kesulitan;
    judulForm.textContent = "Ubah tugas";
    simpan.textContent = "Simpan perubahan";
    batal.hidden = false;
    pesan.textContent = "";
    nama.focus();
}

form.addEventListener("submit", event => {
    event.preventDefault();
    const isian = {
        nama: nama.value.trim(),
        tenggat: tenggat.value,
        kesulitan: kesulitan.value,
    };
    if (!isian.nama || !tenggatValid(isian.tenggat)) {
        pesan.textContent = "Isi nama tugas dan pilih tanggal tenggat.";
        return;
    }

    if (idDisunting) {
        let ditemukan = false;
        ubahDaftar(daftarSaatIni => daftarSaatIni.map(item => {
            if (item.id !== idDisunting) return item;
            ditemukan = true;
            return { ...item, ...isian };
        }));
        pesan.textContent = ditemukan ? "Perubahan disimpan." : "Tugas ini sudah dihapus.";
    } else {
        const id = String(Date.now()) + Math.random().toString(36).slice(2);
        lihatSelesai = false;
        ubahDaftar(daftarSaatIni => [...daftarSaatIni, { id, ...isian, selesai: false }]);
        pesan.textContent = "Tugas ditambahkan.";
    }
    resetForm();
    nama.focus();
});

batal.addEventListener("click", () => {
    resetForm();
    pesan.textContent = "";
    nama.focus();
});

tombolAktif.addEventListener("click", () => {
    lihatSelesai = false;
    tampilkanDaftar();
});

tombolSelesai.addEventListener("click", () => {
    lihatSelesai = true;
    tampilkanDaftar();
});

daftar.addEventListener("click", event => {
    const tombol = event.target.closest("button[data-aksi]");
    if (!tombol) return;

    const id = tombol.closest(".task-row").dataset.id;
    const item = tugas.find(catatan => catatan.id === id);
    if (!item) return;

    if (tombol.dataset.aksi === "ubah") {
        editTugas(item);
        return;
    }

    if (tombol.dataset.aksi === "hapus") {
        if (!window.confirm("Hapus tugas ini? " + item.nama)) return;
        ubahDaftar(daftarSaatIni => daftarSaatIni.filter(catatan => catatan.id !== id));
        if (idDisunting === id) resetForm();
        pesan.textContent = "Tugas dihapus.";
    } else {
        ubahDaftar(daftarSaatIni => daftarSaatIni.map(catatan => (
            catatan.id === id ? { ...catatan, selesai: !item.selesai } : catatan
        )));
        pesan.textContent = item.selesai ? "Tugas kembali aktif." : "Tugas ditandai selesai.";
    }
    if (lihatSelesai) {
        tombolSelesai.focus();
    } else {
        tombolAktif.focus();
    }
});

window.addEventListener("storage", event => {
    if (penyimpananTersedia && (event.key === KUNCI_TUGAS || event.key === null)) {
        tugas = bacaTugas();
        tampilkanDaftar();
    }
});

window.setInterval(() => {
    if (tanggalLokal() !== tanggalTerakhir) tampilkanDaftar();
}, 30_000);

tugas = bacaTugas();
tampilkanDaftar();
