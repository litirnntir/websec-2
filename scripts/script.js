let allStops = [];
let favouriteStops = [];
let myMap;
let placemarks = new Map();
ymaps.ready(initMap);

async function initMap(){
    if(localStorage.getItem('saved') !== null) {
        favouriteStops = JSON.parse(localStorage.getItem('saved'));
    }
    await initSaved();
    myMap = new ymaps.Map("Map",{
        center: [53.202810, 50.109185],
        zoom: 16,
        controls: ['geolocationControl', 'typeSelector']
    });

    await getAllStops().then(async stops =>{
        let arrStop = stops.getElementsByTagName("stop");
        for(const stop of arrStop){
            const KS_ID = stop.getElementsByTagName("KS_ID")[0].textContent;
            const title_station = stop.getElementsByTagName("title")[0].textContent;
            const transferObj = {
                KS_ID,
                title_station,
                adjacent_street: stop.getElementsByTagName("adjacentStreet")[0].textContent,
                direction: stop.getElementsByTagName("direction")[0].textContent,
                x: stop.getElementsByTagName("latitude")[0].textContent,
                y: stop.getElementsByTagName("longitude")[0].textContent
            };
            allStops.push(transferObj);
            localStorage.setItem("res", JSON.stringify(allStops));

            let placemark = new ymaps.Placemark(
                [stop.getElementsByTagName("latitude")[0].textContent, stop.getElementsByTagName("longitude")[0].textContent],
                {
                    balloonContentHeader: `<img id='img_plm_${KS_ID}' src='images/star.png' onclick='Save(${JSON.stringify(transferObj)})' alt="photo"/>${title_station}`,
                    balloonContentBody: `Остановка ${stop.getElementsByTagName("adjacentStreet")[0].textContent} ${stop.getElementsByTagName("direction")[0].textContent}`,
                    hintContent: title_station
                }
            );

            setPlacemark(placemark, stop);

            placemark.events.add('balloonopen', function(e) {
                placemark.properties.set('balloonContentFooter', "Идет загрузка...");
                getInfoByStop(KS_ID).then((stop) =>{
                    let transportContent = "";
                    let transports = stop.getElementsByTagName("transport");
                    if(transports.length === 0){
                        transportContent += "<div class='popup'>В ближайшее время транспорта не будет<br/></div>";
                    } else {
                        transports.forEach(transport => {
                            transportContent += `
                                <div class='popup'>
                                    ${transport.getElementsByTagName("type")[0].textContent} 
                                    ${transport.getElementsByTagName("number")[0].textContent} 
                                    будет через ${transport.getElementsByTagName("time")[0].textContent} мин.<br/>
                                </div>
                            `;
                        });
                    }
                    placemark.properties.set('balloonContentFooter', transportContent);
                });

                if(checkKSInSaved(KS_ID)){
                    placemark.properties.set('balloonContentHeader', `<img id='img_plm_${KS_ID}' src='images/favourite.png' onclick='Save(${JSON.stringify(transferObj)})' alt="photo"/>${title_station}`);
                }
            });

            placemarks.set(KS_ID, placemark);
            myMap.geoObjects.add(placemark);
        }
    });
}

function checkKSInSaved(KS_ID){
    return favouriteStops && favouriteStops.some(item => item.KS_ID === KS_ID);
}

function Save(transferObj){
    let image = document.getElementById(`img_plm_${transferObj.KS_ID}`);
    if(checkKSInSaved(transferObj.KS_ID)){
        image.src = "images/star.png";
        favouriteStops = favouriteStops.filter(item => item.KS_ID !== transferObj.KS_ID);
        localStorage.setItem("saved", JSON.stringify(favouriteStops));
    } else {
        image.src = "images/favourite.png";
        favouriteStops.push(transferObj);
        localStorage.setItem("saved", JSON.stringify(favouriteStops));
    }
    initSaved();
}

function setPlacemark(placemark, stop){
    const types = [
        { tag: "trams", icon: 'redRailwayIcon' },
        { tag: "trolleybuses", icon: 'blueMassTransitIcon' },
        { tag: "metros", icon: 'blueRapidTransitIcon' },
        { tag: "electricTrains", icon: 'blueRailwayIcon' },
        { tag: "riverTransports", icon: 'blueWaterwayIcon' }
    ];

    for (let type of types) {
        if (stop.getElementsByTagName(type.tag)[0].textContent !== "") {
            placemark.options.set('preset', `islands#${type.icon}`);
            break;
        }
    }

    if (!placemark.options.get('preset')) {
        placemark.options.set('preset', 'islands#greenMassTransitIcon');
    }
}

async function getAllStops(){
    const response = await fetch("https://tosamara.ru/api/v2/classifiers/stopsFullDB.xml");
    const res = await response.text();
    return new DOMParser().parseFromString(res, "application/xml");
}

async function getInfoByStop(KS_ID){
    const response = await fetch(`https://tosamara.ru/api/v2/xml?method=getFirstArrivalToStop&KS_ID=${KS_ID}&os=android&clientid=test&authkey=${SHA1(KS_ID + "just_f0r_tests")}`);
    const res = await response.text();
    return new DOMParser().parseFromString(res, "application/xml");
}

async function initSaved(){
    const window_saved_stop = document.querySelector('.menu-stops');
    window_saved_stop.innerHTML = "<button id='button' onclick='activateSearch()'>Поиск</button>";
    window_saved_stop.innerHTML += "<h2>Избранное</h2>";
    favouriteStops.forEach(stop => {
        const updList = document.createElement('div');
        updList.innerHTML = `
            <div class="saved-stop-info">
                <h2>${stop.title_station}</h2>
                <h4>${stop.adjacent_street} ${stop.direction}</h4>
            </div>
        `;
        updList.addEventListener("click", () => {
            myMap.setCenter([stop.x, stop.y]);
            myMap.setZoom(17);
            placemarks.get(stop.KS_ID).balloon.open();
        });
        window_saved_stop.append(updList);
    });
}

function showHiddMenu(){
    const menu = document.getElementById("menu");
    menu.style.visibility = (menu.style.visibility === "visible") ? "hidden" : "visible";
}

function activateSearch(){
    let listElem = document.querySelector('.menu-stops');
    listElem.innerHTML = `
        <button onclick='initSaved()' style='margin:center;'>Закрыть</button>
        <input id="search-input" type="text" placeholder="Поиск..." list="search-list">
        <div id="found-stops" style="display: flex; flex-direction: column; margin: 3px"></div>
    `;
    const foundList = document.querySelector("#found-stops");
    const searchField = document.querySelector("#search-input");

    searchField.addEventListener("input", () => {
        foundList.innerHTML = '';
        allStops.forEach(stop => {
            if (stop.title_station.toLowerCase().includes(searchField.value.toLowerCase())) {
                const updList = document.createElement('div');
                updList.innerHTML = `
                    <div class="saved-stop-info">
                        <h2>${stop.title_station}</h2>
                        <h4>${stop.adjacent_street} ${stop.direction}</h4>
                    </div>
                `;
                foundList.appendChild(updList);
                updList.addEventListener('click', () => {
                    myMap.setCenter([stop.x, stop.y]);
                    myMap.setZoom(19);
                    placemarks.get(stop.KS_ID).balloon.open();
                });
            }
        });

        if (foundList.innerHTML === '') {
            const updList = document.createElement('div');
            updList.innerHTML = `
                <div class="saved-stop-info">
                    <h2>Ничего не найдено</h2>
                </div>
            `;
            foundList.appendChild(updList);
        }
    });
}

function SHA1(msg) {
    function rotate_left(n, s) {
        return (n << s) | (n >>> (32 - s));
    }
    function lsb_hex(val) {
        return [...Array(7).keys()].map(i => {
            let vh = (val >> (i * 4 + 4)) & 0x0f;
            let vl = (val >> (i * 4)) & 0x0f;
            return vh.toString(16) + vl.toString(16);
        }).join('');
    }
    function cvt_hex(val) {
        return [...Array(8).keys()].map(i => {
            let v = (val >> (i * 4)) & 0x0f;
            return v.toString(16);
        }).join('');
    }
    function Utf8Encode(string) {
        return string.replace(/\r\n/g, '\n').split('').map(c => {
            let code = c.charCodeAt(0);
            if (code < 128) return String.fromCharCode(code);
            if (code > 127 && code < 2048) {
                return String.fromCharCode((code >> 6) | 192) + String.fromCharCode((code & 63) | 128);
            }
            return String.fromCharCode((code >> 12) | 224) + String.fromCharCode(((code >> 6) & 63) | 128) + String.fromCharCode((code & 63) | 128);
        }).join('');
    }

    let msg_len = msg.length;
    let word_array = [...Array(Math.ceil(msg_len / 4)).keys()].map(i => {
        return msg.charCodeAt(i * 4) << 24 | msg.charCodeAt(i * 4 + 1) << 16 | msg.charCodeAt(i * 4 + 2) << 8 | msg.charCodeAt(i * 4 + 3);
    });

    word_array.push(msg_len % 4 === 0 ? 0x080000000 : msg.charCodeAt(msg_len - 1) << 24 | 0x0800000);

    while (word_array.length % 16 !== 14) word_array.push(0);

    word_array.push(msg_len >>> 29);
    word_array.push(msg_len << 3);
    let H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];

    for (let i = 0; i < word_array.length; i += 16) {
        let W = word_array.slice(i, i + 16);
        let A = H[0], B = H[1], C = H[2], D = H[3], E = H[4];

        for (let j = 0; j < 80; j++) {
            let temp = rotate_left(A, 5) + (j < 20 ? (B & C) | ((~B) & D) : (j < 40 ? B ^ C ^ D : j < 60 ? (B & C) | (B & D) | (C & D) : B ^ C ^ D)) + E + (W[j] || 0) + 0x5a827999;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        H[0] = H[0] + A;
        H[1] = H[1] + B;
        H[2] = H[2] + C;
        H[3] = H[3] + D;
        H[4] = H[4] + E;
    }

    return H.map(cvt_hex).join('');
}
