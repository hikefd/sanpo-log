
<script setup>
import { ref, computed } from 'vue';
import { Vector3 } from 'three';
const CS = [
    3.979145,
    -0.654499,
    1.74069,
    -4.608815,
    6.7926,
    -5.39691,
    2.19297,
    -0.359496,
];
function Horner(a, n, x) {
    let result = a[n];
    let i = n - 1;
    while (i >= 0) {
        result = result * x + a[i];
        i -= 1;
    }
    return result;
}

let stars = ref([]);
fetch('/src/assets/bsc5.dat').then((res) => res.text()).then((text) => {
    let lines = text.split(/\n/);
    let arr = [];
    lines.forEach((l) => {
        if (parseFloat(l.substring(102, 107), 10)) {
            let bv = parseFloat(l.substring(109, 114), 10);
            arr.push({
                // とりあえずparseFloatで
                mag: parseFloat(l.substring(102, 107), 10),
                glon: parseFloat(l.substring(90, 96), 10),
                glat: parseFloat(l.substring(96, 102), 10),
                bv,
                color: chroma.temperature(10 ** Horner(CS, 7, bv)),
            });
        }
    });
    stars.value = arr;
});

const TAU = Math.PI * 2;
const d2r = (deg) => (deg * Math.PI / 180);
const r2d = (rad) => (rad * 180 / Math.PI);
const colors = [
    //alt: 対応する太陽高度, gamma: スケールのガンマ, offset: 星の等級オフセット, zenith: 天頂色, mid: 中間色, hrorizon: sun: 地平色（太陽側…のみ）
    { alt: -99, gamma: 1.7, offset: 0, zenith: '#021227', mid: '#031e57', horizon: { sun: '#1f5384', oppo: '' }, },
    { alt: -30, gamma: 6.2, offset: 0, zenith: '#031e57', mid: '#031e57', horizon: { sun: '#1f5384', oppo: '' }, },
    { alt: -20, gamma: 16.0, offset: -1, zenith: '#131f67', mid: '#3c2d48', horizon: { sun: '#8a414b' } },
    { alt: -15, gamma: 32.0, offset: -2, zenith: '#005a8d', mid: '#623b33', horizon: { sun: '#793c1e' } },
    //{ alt:  -10, gamma: 16.2, zenith: '#131f67', mid: '#dd5824', horizon: { sun: '#f17b4e', oppo: '' }, },
    { alt: -8, gamma: 24.0, offset: -3, zenith: '#3e6192', mid: '#d5c1a1', horizon: { sun: '#f0aa6b' } },
    { alt: -5, gamma: 16.2, offset: -5, zenith: '#7E97C0', mid: '#E7CED1', horizon: { sun: '#E8C46E', oppo: '' }, },
    { alt: 8, gamma: 8.0, offset: -8, zenith: '#7FACCD', mid: '#BAD0DE', horizon: { sun: '#F6D0C3' } },
    { alt: 15, gamma: 4.3, offset: -10, zenith: '#67B9F3', mid: '#9FE2FF', horizon: { sun: '#74b8e6', oppo: '' }, },
    { alt: 30, gamma: 4.3, offset: -10, zenith: '#3199F8', mid: '#3CADFB', horizon: { sun: '#74b8e6', oppo: '' }, },
    { alt: 40, gamma: 4.3, offset: -10, zenith: '#3D7DE7', mid: '#33A4FF', horizon: { sun: '#74b8e6', oppo: '' }, },
    //{ alt:  40, gamma:  2.5, zenith: '#0236a3', mid: '#0f7bc6', horizon: { sun: '#6eb3fe', oppo: '' }, },
    { alt: 99, gamma: 1.0, offset: -10, zenith: '#0040a0', mid: '#0236a3', horizon: { sun: '#1c8cc5', oppo: '' }, },
];
// 水蒸気量
const humid = ref(0);
// 太陽高度[deg]
const sunHeight = ref(0);
// 地球半径[km]
const radius = 6371;
// 大気厚み[km]
const atomos = ref(100);
// 緯度[deg]
const props = defineProps([
    'lat',
    'lon',
    'alt',
    'datetime',
]);
// 地軸の傾き
const phi = 23.4;
// 春分からの日数 0-365
const day = computed(() => props.datetime.ordinal);
// 年数
const year = computed(() => props.datetime.year);
// 時刻
const hour = computed(() => props.datetime.hour + props.datetime.minute / 60 + props.datetime.second / 3600 + props.datetime.millisecond / 3600000);
// mixmode
const mixmode = ref('lch'); // lab, rgb
// 分割数
const div = ref(72);
// 太陽色スケール
const sunColorScale = chroma.scale(['#ffffff', '#fe807f']).mode('lch');
const gradScales = computed(() => {
    return Object.keys(colors).map((t) => {
        const scale = chroma.scale([colors[t].zenith, colors[t].mid, colors[t].horizon.sun]).mode(mixmode.value).gamma(colors[t].gamma);
        const arr = [];
        for (let i = 0; i <= div.value; i++) {
            arr.push(scale(i / div));
        }
        return { scale: arr, color: colors[t] };
    });
});
// 時
/* hour() {
    let [h, m, s = 0] = this.time.split(':');
    return +h + m/60 + s/3600; 
},*/
// 惑星パラメータ
const planetParam = {
    moon: {}
};

const calcJD = (y, l, d, h, m, s) => {
    return Math.floor(365.25 * y) + Math.floor(y / 400) - Math.floor(y / 100)
        + Math.floor(30.59 * (l - 2)) + d + 1721088.5
        + (h + (m + s / 60) / 60) / 24;
};
// ユリウス日 フリーゲルの式
const JD = computed(() => {
    return calcJD(year.value, props.datetime.month, props.datetime.day, hour.value + 9, 0, 0);
    /*Math.floor(365.25 * y) + Math.floor(y / 400) - Math.floor(y/100) 
    + Math.floor(30.59 * (props.datetime.month - 2)) + props.datetime.day + 1721088.5
    + hour.value / 24;*/
});
// J2000に対するJD
const J2000JD = computed(() => {
    return (JD - 2451545) / 36525;
});
// グリニッジ平均恒星時
const GMST = computed(() => {
    return 67310.54841 + (8640184.81286 * J2000JD)
});

// © 2022 Meteorologi cal Data System, Co. Ltd. All Rights Reserved TE_Simplified_SP_220805.pdf.pdf
// 黄道傾斜角[deg]
const dec0 = computed(() => { return - phi + 0.013 * 20 / 100 });
// 平均近点離角[deg]
const mm = computed(() => { return 360 * (day.value - 3.71 + 0.2596 * (year.value - 1968)) / 365 });
// 冬至点と近日点がなす角度[deg]
const ep = computed(() => { return 12.3901 + 0.0172 * (year.value - 1968 + mm.value / 360) });
// 真近点離角[deg] 
const v = computed(() => { return mm.value + 1.918 * Math.sin(d2r(mm.value)) + 0.02 * Math.sin(d2r(mm.value * 2)) });
// 視赤緯 declination[rad]
const dec = computed(() => { return Math.asin(Math.cos(d2r(ep.value + v.value)) * Math.sin(d2r(dec0.value))) });
// 均時差[rad]
const et = computed(() => { return d2r(mm.value - v.value) - Math.atan(0.043 * Math.sin(2 * d2r(ep.value + v.value)) / (1 - 0.043 * Math.cos(2 * d2r(ep.value + v.value)))) });
// 時角[rad]
const th = computed(() => { return d2r(15 * (hour.value - 12) + (props.lon - 135)) });

// 赤道座標から高度に変換する関数
const gPos = computed(() => {
    const ls = Math.sin(d2r(props.lat));
    const lc = Math.cos(d2r(props.lat));
    return (dec, rc) => {
        const alt = Math.asin(ls * Math.sin(dec) + lc * Math.cos(dec) * Math.cos(th.value - rc));
        const y = Math.cos(dec) * Math.sin(th.value - rc) / Math.cos(alt);
        const x = (Math.sin(alt) * ls - Math.sin(dec)) / (Math.cos(alt) * lc);
        const azm = Math.atan2(y, x);
        return { azm, alt };
    };
});
const alt = computed(() => {
    const ls = Math.sin(d2r(props.lat));
    const lc = Math.cos(d2r(props.lat));
    return (dec, rc) => {
        return Math.asin(ls * Math.sin(dec) + lc * Math.cos(dec) * Math.cos(th.value - rc));
    };
})
// dec: 赤緯, rc: 赤経
const azm = computed(() => {
    const ls = Math.sin(d2r(props.lat));
    const lc = Math.cos(d2r(props.lat));
    return (dec, rc) => {
        const a = alt.value(dec, 0);
        const y = Math.cos(dec) * Math.sin(th.value - rc) / Math.cos(a);
        const x = (Math.sin(a) * ls - Math.sin(dec)) / (Math.cos(a) * lc);
        return Math.atan2(y, x);
    };
})
// 太陽高度[rad]
const sunPos = computed(() => {
    return gPos.value(dec.value, 0);
});
const sunAlt = computed(() => {
    // 南中高度はこれ　return (90-this.lat)+this.phi * Math.sin();
    return alt.value(dec.value, 0);
    // return Math.asin( Math.sin(d2r(props.lat))*Math.sin(dec.value) + Math.cos(d2r(props.lat))*Math.cos(dec.value)*Math.cos(th.value) );
});
// 太陽方位角[rad]
const sunAzm = computed(() => {
    return azm.value(dec.value, 0);
    /*const y = Math.cos(dec.value) * Math.sin(th.value) / Math.cos(sunPos.value.alt);
    const x = (Math.sin(sunPos.value.alt) * Math.sin(d2r(props.lat))-Math.sin(dec.value)) / (Math.cos(sunPos.value.alt)*Math.cos(d2r(props.lat)));
    return Math.atan2(y, x); */
});
// 星の輝度オフセット
const offset = ref(0);
const skyGrad = computed(() => {
    // 仰角の値に応じて参照配列を取得する
    const deg = r2d(sunPos.value.alt);
    let idx = 0;
    for (idx = 0; idx < colors.length - 1; idx++) {
        if (colors[idx + 1].alt > deg) {
            break;
        }
    }
    const c0 = colors[idx];
    const c1 = colors[idx + 1];
    // 按分量
    const ratio = (deg - c0.alt) / (c1.alt - c0.alt);
    // 按分した値で決定する
    const mixmode = 'lab';
    const zenith = chroma.mix(c0.zenith, c1.zenith, ratio, mixmode);
    const mid = chroma.mix(c0.mid, c1.mid, ratio, mixmode);
    const sun = chroma.mix(c0.horizon.sun, c1.horizon.sun, ratio, mixmode);
    const gamma = (1 - ratio) * c0.gamma + ratio * c1.gamma;
    const scale = chroma.scale([zenith, mid, sun]).mode(mixmode.value).gamma(gamma);
    // 副次的な値だがここで計算してしまう watchにすべき
    offset.value = (1 - ratio) * c0.offset + ratio * c1.offset;
    const arr = [];
    for (let i = 0; i <= div.value; i++) {
        arr.push({ color: scale(i / div.value), percent: i * 100 / div.value });
    }
    return arr;
});
//太陽色
const sunColor = computed(() => {
    return sunColorScale(
        (thickness(sunPos.value.alt) - thickness(Math.PI / 2)) / (thickness(0) - thickness(Math.PI / 2))
    );
});
// 仰角に合わせた配色
const autoScale = computed(() => {

    const arr = [];
    for (let i = 0; i <= div.value; i++) {
        arr.push(scale(i / div.value));
    }
    return { scale: arr, color: colors[t], };
});
const colStr = (col) => {
    return chroma(col);
};
const hueStr = (col) => {
    return chroma(col).get('hsl.h').toFixed(1);
};
// 仰角に応じた大気厚み (x+R)^2+y^2 = (R+h)^2を極座標変換
const thickness = (theta) => {
    const p = theta - Math.PI / 2;
    return Math.sqrt(
        (radius * Math.cos(p)) ** 2 + 2 * atomos.value * radius + atomos.value ** 2
    ) - radius * Math.cos(p);
};

// 銀河座標
const gRA = TAU * (12 + (51 + (26.282 / 60) / 60) / 24); // rad J2000.0 分点では赤経12h51m26.282s、赤緯+27°07'42.01"
const gD = d2r(27 + (7 + (42.01 / 60)) / 60);
const gOmg = TAU * (18 + (56 + (4 / 60) / 60) / 24); // 対赤道座標昇交点の赤経
const gI = d2r(62 + 52 / 60);// 銀河面の赤道面への傾斜角
const gTh = d2r(32 + 56 / 60); // 昇交点との銀径

const axeX = new Vector3(1, 0, 0);
const axeY = new Vector3(0, 1, 0);
const axeZ = new Vector3(0, 0, 1);
// 銀河座標から赤道座標への回転を実施したVector
const bl2equVec = (glon, glat) => {
    const vec = new Vector3(
        Math.cos(glat) * Math.cos(gTh - glon),
        Math.cos(glat) * Math.sin(gTh - glon),
        Math.sin(glat),
    );
    // 時計周りにgI回転->時計回りにgOmg回転で赤道座標、地平座標
    return vec.applyAxisAngle(axeX, -gI)
        .applyAxisAngle(axeZ, -gOmg)
        .applyAxisAngle(axeZ, th.value)
        .applyAxisAngle(axeY, Math.PI / 2 - d2r(props.lat));
};
// 

// 明るいもののみ
const brightStars = computed(() => {
    return stars.value.sort((a, b) => a.mag - b.mag).slice(0, 9000).map((s) => {
        const vec = bl2equVec(d2r(s.glon), d2r(s.glat));
        const azm = Math.PI + Math.atan2(vec.y, vec.x);
        const alt = Math.asin(vec.z);
        return {
            azm,
            alt,
            r: Math.log(6 - s.mag + offset.value),
            ...s,
        }
    }).filter(s => s.r > 0);
});

const modulo = (a, n) => (((a % n) + n) % n);

// 月 平均朔望周期から位置も含め概算で求めてしまう
// 平均朔望周期[sec]
const MEAN_MOON_T = 29.53059;
// 基準の朔時刻を金冠皆既日食の2023/04/20 04:17:56Zとする
const DEST_MOON_BIRTH_JD = calcJD(2023, 4, 20, 4, 17, 56);
// const DEST_MOON_BIRTH_JD = calcJD(2022, 5, 30, 20+9, 30, 0);
//const DEST_MOON_BIRTH_JD = calcJD(2022, 12, 23, 19+9, 17, 0);
// 月相[rad]
const moonPhase = computed(() => {
    return TAU * modulo(JD.value - DEST_MOON_BIRTH_JD, MEAN_MOON_T) / MEAN_MOON_T;
});
const moonPos = computed(() => {
    return gPos.value(dec.value, moonPhase.value);
});

// ビューワ座標への変換
const mainCX = (azm, alt) => { return ((azm + Math.PI) / TAU) % 1 * 900 };
const mainCY = (azm, alt) => { return ((Math.PI / 2 - alt) / Math.PI) * 2 * 400 };

const subCX = (azm, alt) => { return 50 + 50 * (1 - alt * 2 / Math.PI) * Math.cos(azm + Math.PI / 2) };
const subCY = (azm, alt) => { return 50 + 50 * Math.sin(azm + Math.PI / 2) * (1 - alt * 2 / Math.PI) };


const junishi = '子丑寅卯辰巳午未申酉戌亥'.split('');
// 当日の日の出日の入りを計算　view-source:https://www.hoshi-lab.info/env/solar-j.html
// 毎分の太陽位置を算出している
// sin function using degree
function sind(d) {
    return Math.sin(d * Math.PI / 180);
}
// cos function using degree
function cosd(d) {
    return Math.cos(d * Math.PI / 180);
}
// tan function using degree
function tand(d) {
    return Math.tan(d * Math.PI / 180);
}
// calculate Julius year (year from 2000/1/1, for variable "t")
function jy(yy, mm, dd, h, m, s, i) { // yy/mm/dd h:m:s, i: time difference
    yy -= 2000;
    if (mm <= 2) {
        mm += 12;
        yy--;
    }
    let k = 365 * yy + 30 * mm + dd - 33.5 - i / 24 + Math.floor(3 * (mm + 1) / 5)
        + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400);
    k += ((s / 60 + m) / 60 + h) / 24; // plus time
    k += (65 + yy) / 86400; // plus delta T
    return k / 365.25;
}
// solar position1 (celestial longitude, degree)
function spls(t) { // t: Julius year
    let l = 280.4603 + 360.00769 * t
        + (1.9146 - 0.00005 * t) * sind(357.538 + 359.991 * t)
        + 0.0200 * sind(355.05 + 719.981 * t)
        + 0.0048 * sind(234.95 + 19.341 * t)
        + 0.0020 * sind(247.1 + 329.640 * t)
        + 0.0018 * sind(297.8 + 4452.67 * t)
        + 0.0018 * sind(251.3 + 0.20 * t)
        + 0.0015 * sind(343.2 + 450.37 * t)
        + 0.0013 * sind(81.4 + 225.18 * t)
        + 0.0008 * sind(132.5 + 659.29 * t)
        + 0.0007 * sind(153.3 + 90.38 * t)
        + 0.0007 * sind(206.8 + 30.35 * t)
        + 0.0006 * sind(29.8 + 337.18 * t)
        + 0.0005 * sind(207.4 + 1.50 * t)
        + 0.0005 * sind(291.2 + 22.81 * t)
        + 0.0004 * sind(234.9 + 315.56 * t)
        + 0.0004 * sind(157.3 + 299.30 * t)
        + 0.0004 * sind(21.1 + 720.02 * t)
        + 0.0003 * sind(352.5 + 1079.97 * t)
        + 0.0003 * sind(329.7 + 44.43 * t);
    while (l >= 360) { l -= 360; }
    while (l < 0) { l += 360; }
    return l;
}
// solar position2 (distance, AU)
function spds(t) { // t: Julius year
    let r = (0.007256 - 0.0000002 * t) * sind(267.54 + 359.991 * t)
        + 0.000091 * sind(265.1 + 719.98 * t)
        + 0.000030 * sind(90.0)
        + 0.000013 * sind(27.8 + 4452.67 * t)
        + 0.000007 * sind(254 + 450.4 * t)
        + 0.000007 * sind(156 + 329.6 * t)
    r = Math.pow(10, r);
    return r;
}
// solar position3 (declination, degree)
function spal(t) { // t: Julius year
    let ls = spls(t);
    let ep = 23.439291 - 0.000130042 * t;
    let al = Math.atan(tand(ls) * cosd(ep)) * 180 / Math.PI;
    if ((ls >= 0) && (ls < 180)) {
        while (al < 0) { al += 180; }
        while (al >= 180) { al -= 180; }
    } else {
        while (al < 180) { al += 180; }
        while (al >= 360) { al -= 180; }
    }
    return al;
}
// solar position4 (the right ascension, degree)
function spdl(t) { // t: Julius year
    let ls = spls(t);
    let ep = 23.439291 - 0.000130042 * t;
    let dl = Math.asin(sind(ls) * sind(ep)) * 180 / Math.PI;
    return dl;
}
// Calculate sidereal hour (degree)
function sh(t, h, m, s, l, i) { // t: julius year, h: hour, m: minute, s: second,
    // l: longitude, i: time difference
    let d = ((s / 60 + m) / 60 + h) / 24; // elapsed hour (from 0:00 a.m.)
    let th = 100.4606 + 360.007700536 * t + 0.00000003879 * t * t - 15 * i;
    th += l + 360 * d;
    while (th >= 360) { th -= 360; }
    while (th < 0) { th += 360; }
    return th;
}
// Calculating the seeming horizon altitude "sa"(degree)
function eandp(alt, ds) { // subfunction for altitude and parallax
    let e = 0.035333333 * Math.sqrt(alt);
    let p = 0.002442818 / ds;
    return p - e;
}
function sa(alt, ds) { // alt: altitude (m), ds: solar distance (AU)
    let s = 0.266994444 / ds;
    let r = 0.585555555;
    let k = eandp(alt, ds) - s - r;
    return k;
}
// Calculating solar alititude (degree) {
function soal(la, th, al, dl) { // la: latitude, th: sidereal hour,
    // al: solar declination, dl: right ascension
    let h = sind(dl) * sind(la) + cosd(dl) * cosd(la) * cosd(th - al);
    h = Math.asin(h) * 180 / Math.PI;
    return h;
}
// Calculating solar direction (degree) {
function sodr(la, th, al, dl) { // la: latitude, th: sidereal hour,
    // al: solar declination, dl: right ascension
    let t = th - al;
    let dc = - cosd(dl) * sind(t);
    let dm = sind(dl) * sind(la) - cosd(dl) * cosd(la) * cosd(t);
    let dr = 0;
    if (dm == 0) {
        let st = sind(t);
        if (st > 0) dr = -90;
        if (st == 0) dr = 9999;
        if (st < 0) dr = 90;
    } else {
        dr = Math.atan(dc / dm) * 180 / Math.PI;
        if (dm < 0) dr += 180;
    }
    if (dr < 0) dr += 360;
    return dr;
}
function calcSunrise(
    yy, // 年
    mm, // 月
    dd, // 日
    i, // 時差 
    la, // 緯度
    lo, // 経度
    alt = 0, // 標高
) {
    //ans = yy + "年" + mm + "月" + dd + "日の計算結果\n";

    let t = jy(yy, mm, dd - 1, 23, 59, 0, i);
    let th = sh(t, 23, 59, 0, lo, i);
    let ds = spds(t);
    let ls = spls(t);
    let alp = spal(t);
    let dlt = spdl(t);
    let pht = soal(la, th, alp, dlt);
    let pdr = sodr(la, th, alp, dlt);

    // 日の出分
    let tRise = 0;
    // 日の入り分
    let tSet = 0;
    for (let hh = 0; hh < 24; hh++) {
        // 正確な分がいらないので10分おき
        for (let m = 0; m < 60; m += 5) {
            let t = jy(yy, mm, dd, hh, m, 0, i);
            let th = sh(t, hh, m, 0, lo, i);
            let ds = spds(t);
            let ls = spls(t);
            let alp = spal(t);
            let dlt = spdl(t);
            let ht = soal(la, th, alp, dlt);
            let dr = sodr(la, th, alp, dlt);
            let tt = eandp(alt, ds);
            let t1 = tt - 18;
            let t2 = tt - 12;
            let t3 = tt - 6;
            let t4 = sa(alt, ds);
            // Solar check 
            // 0: non, 1: astronomical twilight start , 2: voyage twilight start,
            // 3: citizen twilight start, 4: sun rise, 5: meridian, 6: sun set,
            // 7: citizen twilight end, 8: voyage twilight end,
            // 9: astronomical twilight end
            //if ((pht < t1) && (ht > t1)) ans += hh + "時" + m + "分 天文薄明始まり\n";
            //if ((pht < t2) && (ht > t2)) ans += hh + "時" + m + "分 航海薄明始まり\n";
            //if ((pht < t3) && (ht > t3)) ans += hh + "時" + m + "分 市民薄明始まり\n";
            if ((pht < t4) && (ht > t4)) {
                //日の出ans += hh + "時" + m + "分 日出(方位" + Math.floor(dr) + "度)\n";
                tRise = (hh * 60 + mm) / 1440;
            }
            //if ((pdr < 180) && (dr > 180)) ans += hh + "時" + m + "分 南中(高度" + Math.floor(ht) + "度)\n";
            if ((pht > t4) && (ht < t4)) {
                // 日の入り ans += hh + "時" + m + "分 日没(方位" + Math.floor(dr) + "度)\n";
                tSet = (hh * 60 + mm) / 1440;
            }
            //if ((pht > t3) && (ht < t3)) ans += hh + "時" + m + "分 市民薄明終わり\n";
            //if ((pht > t2) && (ht < t2)) ans += hh + "時" + m + "分 航海薄明終わり\n";
            //if ((pht > t1) && (ht < t1)) ans += hh + "時" + m + "分 天文薄明終わり\n";
            pht = ht;
            pdr = dr;
        }
    }
    // 十二支各時刻の日内割合(1日で1)
    let tMap = new Map();
    // 日の出と日の入りから時を求める 北半球、日昇日没のある想定
    for (let i = 0; i < 6; i++) {
        // 日中 卯から酉を6分割
        tMap.set(junishi[i + 3], i * (tSet - tRise) / 6 + tRise);
        // 日没 酉から卯を6分割
        tMap.set(junishi[(i + 9) % 12], (i * (1 + tRise - tSet) / 6 + tSet)%1);
    }
    tMap.set('alt', alt);
    return tMap;
}
const junishiMap = computed(() => {
    return calcSunrise(
        props.datetime.year,
        props.datetime.month,
        props.datetime.day,
        9,
        props.lat, props.lon, props.alt,
    );
});

</script>
<template>
    <div style="position: relative;">
        <svg width="100%" height="100%" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice">
            <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
                <stop v-for="(g, idx) in skyGrad" :stop-color="g.color" :offset="g.percent + '%'" />
            </linearGradient>
            <radialGradient id="skyRad" x1="0" x2="0" y1="0" y2="1">
                <stop v-for="(g, idx) in skyGrad" :stop-color="g.color" :offset="g.percent + '%'" />
            </radialGradient>
            <linearGradient id="fog" x1="0" x2="0" y1="0" y2="1">
                <stop stop-color="#ffffff00" offset="0%" />
                <stop stop-color="#ffffff66" offset="100%" />
            </linearGradient>
            <radialGradient id="RadialGradient1">
                <stop offset="0%" :stop-color="sunColor" />
                <stop offset="0.4%" :stop-color="sunColor" />
                <stop offset="2%" stop-color="#ffffff94" />
                <stop offset="15%" stop-color="#ffffff44" />
                <stop offset="27%" stop-color="#ffffff34" />
                <stop offset="60%" stop-color="#ffffff14" />
                <stop offset="100%" stop-color="#ffffff00" />
            </radialGradient>
            <!-- 太陽 -->


            <rect fill="url(#sky)" width="900" height="400" style="mix-blend-mode: hard-light"></rect>
            <!-- 太陽 -->
            <circle style="mix-blend-mode: screen" :cx="mainCX(sunPos.azm, sunPos.alt)" :cy="mainCY(sunPos.azm, sunPos.alt)"
                r="7" :fill="sunColor"></circle>

            <circle style="mix-blend-mode: overlay" :cx="mainCX(sunPos.azm, sunPos.alt)"
                :cy="mainCY(sunPos.azm, sunPos.alt)" r="800" fill="url(#RadialGradient1)"></circle>
            <!-- 月 -->
            <circle style="mix-blend-mode: screen" :cx="mainCX(moonPos.azm, moonPos.alt)"
                :cy="mainCY(moonPos.azm, moonPos.alt)" r="7" fill="#ffffaf" :opacity="1 - Math.log(+offset)"></circle>
            <!-- 満ち欠け影
            <ellipse 
                style="mix-blend-mode: normal"
                :cx="mainCX(moonPos.azm, moonPos.alt)"
                :cy="mainCY(moonPos.azm, moonPos.alt)"
                rx="7"
                :ry="7*(1-Math.cos(moonPhase))"
                fill="#000"
            ></ellipse>
            -->
            <!-- 星 -->
            <circle v-for="s in brightStars" style="mix-blend-mode: normal" :cx="mainCX(s.azm, s.alt)"
                :cy="mainCY(s.azm, s.alt)" :r="s.r / 2" :fill="s.color"></circle>

            <text x="124" y="24" font-size="14px" fill="white">ALT: {{ r2d(sunPos.alt).toFixed(2) }}deg</text>
            <text x="124" y="48" font-size="14px" fill="white">AZM: {{ r2d(sunPos.azm).toFixed(2) }}deg</text>
            <text x="124" y="72" font-size="14px" fill="white">MOON_PHASE: {{ moonPhase }}</text>
            <!-- 等距 -->
            <clipPath id="wipe">
                <rect x="0" y="0" width="100" height="100"></rect>
            </clipPath>
            <rect x="0" y="0" width="100" height="100" fill="black"></rect>
            <g clip-path="url(#wipe)">
                <circle cx="50" cy="50" r="50" fill="url(#skyRad)"></circle>
                <!-- 星 -->
                <circle v-for="s in brightStars" style="mix-blend-mode: normal" :cx="subCX(s.azm, s.alt)"
                    :cy="subCY(s.azm, s.alt)" :r="s.r / 5" :fill="s.color"></circle>
                <circle :cx="subCX(moonPos.azm, moonPos.alt)" :cy="subCY(moonPos.azm, moonPos.alt)" r="4" fill="#ffffaf">
                </circle>
                <!-- 太陽 -->
                <circle :cx="subCX(sunPos.azm, sunPos.alt)" :cy="subCY(sunPos.azm, sunPos.alt)" r="4" :fill="sunColor">
                </circle>
            </g>
        </svg>
        <svg width="100%" height="100%" viewBox="0 0 900 400" style="filter: blur(1px)"
            preserveAspectRatio="xMidYMid slice">
            <path d="M 0 400 L 900 400 L 450 390 Z" fill="#025434"></path>
            <rect fill="url(#fog)" width="900" height="400" style="mix-blend-mode: screen" :opacity="humid"></rect>
        </svg>
        <!-- 時計 -->
        <svg width="100px" height="100px" viewBox="0 0 100 100" style="position: absolute; left: 600px;right: 0; top: 0;"
            preserveAspectRatio="xMidYMid slice">
            <g>
                <!-- 現代時計 -->
                <circle cx="50" cy="50" r="40" fill="#22344499"></circle>
                <!-- 長針 -->
                <path d="M 50 50 L 50 12" stroke="white" :transform="`rotate(${hour * 360}, 50, 50)`"></path>
                <!-- 短針 -->
                <path d="M 50 50 L 50 26" stroke="white" :transform="`rotate(${hour * 360 / 12}, 50, 50)`" stroke-width="3">
                </path>
                <text x="0" y="100" font-family="monospace" font-size="10" fill="white">{{
                    props.datetime.toFormat('yyyy-LL-dd HH:mm:ss') }}</text>
            </g>
        </svg>
        <svg width="200px" height="12px" viewBox="0 0 200 12" style="position: absolute; left: 600px;right: 0; top: 100px;"
            preserveAspectRatio="xMidYMid slice">
            <g>
                <rect x="0" y="0" width="200" height="12" fill="#22334499"></rect>
                <text v-for="j in junishi" font-size="10px" text-anchor="middle" :x="junishiMap.get(j) * 200" y="10" fill="white">{{ j
                }}</text>
                <!-- 子を折り返す -->
                <text font-size="10px" text-anchor="middle" :x="junishiMap.get('子') * 200 - 200" y="10" fill="white">子</text>
                <rect :x="(hour/24)%1 * 200 - 6" y="0" width="12" height="12" stroke="white" fill="none"></rect>
            </g>

        </svg>
        <!--<div style="position: absolute; color: white;">
            <table>
                <tr><th>分割数</th><td><input type="number" v-model="div"></td></tr>
                <tr><th>年</th><td><input type="number" v-model="year"></td></tr>
                <tr><th>春分からの日数</th><td><input type="range" v-model="day" min="0" max="365">{{day}}</td></tr>
                <tr><th>時刻</th><td><input type="range" v-model="hour" min="0" max="24" step="0.01">{{hour}}</td></tr>
                <tr><th>黄道傾斜角[deg] dec0 </th><td>{{ dec0 }}</td></tr>
                <tr><th>平均近点離角[deg] mm </th><td>{{ mm }}</td></tr>
                <tr><th>冬至点と近日点がなす角度[deg] ep </th><td>{{ ep }}</td></tr>
                <tr><th>真近点離角[deg]  v </th><td>{{ v }}</td></tr>
                <tr><th>視赤緯 declination[rad] dec </th><td>{{ dec }}</td></tr>
                <tr><th>均時差[rad] et </th><td>{{ et }}</td></tr>
                <tr><th>th </th><td>{{ th }}</td></tr>
                <tr><th> sunPos.alt[rad] </th><td>{{ sunPos.alt }}</td></tr>
                <tr><th> sunPos.azm[rad] </th><td>{{ sunPos.azm }}</td></tr>
                <tr><th> sunColor </th><td>{{ sunColor }}</td></tr>
                <tr><th>thickNess</th><td>{{ thickness(sunPos.alt)  }}</td></tr>
                <tr><th>humid</th><td><input type="range" v-model="humid" min="0" max="1" step="0.1">{{ humid }}</td></tr>
            </table>
        </div>-->

    </div>
</template>

<style scoped>
:root {
    font-family: 'Iosevka Custom', '更紗等幅ゴシック J', Consolas, 'Courier New', monospace;
}

svg {
    /*position: absolute;*/
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
}

.l {
    width: 20px;
    height: 20px;
    background: linear-gradient(to right, indigo, pink, orange, blue, indigo);
}

.lane {
    width: 20px;
    display: inline-block;
    position: relative;
}

.tick {
    width: 20px;
    height: 4px;
}

.zenith,
.bottom {
    position: absolute;
    width: 20px;
    font-size: 8px;
}

.zenith {
    top: 0;
}

.bottom {
    bottom: 0;
}

.sun {
    position: absolute;
}
</style>