function randInt(n) {
    while (true) {
        const a = new Uint32Array(1);
        crypto.getRandomValues(a);
        if (a[0]<Math.floor(0x100000000/n)*n) {
            return a[0]%n;
        }
    }
}

function makeSeed(n) {
    let seed = 0n;
    for (let i=1; i<=n; i++) {
        seed *= BigInt(i);
        seed += BigInt(randInt(i));
    }
    return seed;
}

// Fisher–Yates shuffle。
function shuffle(n, seed) {
    const used = Array(n);
    const cards = [];
    for (let i=0; i<n; i++) {
        let r = seed%BigInt(n-i);
        seed /= BigInt(n-i);

        for (let j=0; j<n; j++) {
            if (!used[j]) {
                if (r==0) {
                    cards.push(j);
                    used[j] = true;
                }
                r--;
            }
        }
    }
    return cards;
}

function makeAlgorithm(n, cards, seed) {
    // 山数。
    const K = 4;

    // ステップ数。
    let s = 0;
    // s^K。
    let sn = 1;
    while (sn<n) {
        s++;
        sn *= K;
    }

    // C をソートするような手順が、ソートした状態から cards を生成する C を求める。
    let C = Array(n);
    {
        // 各山の枚数がほぼ同数になるように、余剰分を水増し。
        const T = Array(sn);
        for (let i=0; i<n; i++) {
            T[i] = 0;
        }
        for (let i=n; i<sn; i++) {
            T[i] = 1;
        }

        for (let i=sn-1; i>0; i--) {
            const r = seed%BigInt(i+1);
            const t = T[i];
            T[i] = T[r];
            T[r] = t;
        }

        let p = 0;
        for (let i=0; i<sn; i++) {
            if (T[i]==0) {
                C[cards[p++]] = i;
            }
        }
    }

    // C をソートする手順を生成。
    // 基数ソート。
    const A = [];
    let b = 1;
    for (let i=0; i<s; i++) {
        A.push([]);
        const T = [];
        for (let j=0; j<K; j++) {
            T.push([]);
        }

        for (let j=C.length-1; j>=0; j--) {
            let p = (C[j]/b|0)%K;
            // この手順では順序が反転するので、残り回数が奇数なら逆順。
            if ((s-i-1)%2!=0) {
                p = K-p-1;
            }
            A[i].push(p);
            T[p].push(C[j]);
        }

        C = [];
        for (const t of T) {
            for (const c of t) {
                C.push(c);
            }
        }
        b *= K;
    }

    return A;
}

function elem(id) {
    return document.getElementById(id);
}

const elNumber = elem("number");
for (let n=2; n<=100; n++) {
    const e = document.createElement("option");
    e.textContent = ""+n;
    elNumber.appendChild(e);
}

function loadConfig() {
    let config = {};
    const conf = localStorage.getItem("perfect_card_shuffler");
    if (conf) {
        config = JSON.parse(conf);
    }

    if (!config.number) {
        config.number = 52;
    }
    if (!config.face) {
        config.face = "card";
    }
    if (config.showCards===undefined) {
        config.showCards = true;
    }

    return config;
}

function saveConfig(config) {
    localStorage.setItem("perfect_card_shuffler", JSON.stringify(config));
}

function update(config, seed) {
    elem("seed").textContent = ""+seed;

    const url = new URL(window.location.href);
    url.hash = `number=${config.number}&face=${config.face}&seed=${seed}`;
    elem("permalink").href = url.toString();

    const cards = shuffle(config.number, seed);

    const algorithm = makeAlgorithm(config.number, cards, seed);

    const elAlgorithm = elem("algorithm");
    while (elAlgorithm.firstChild) {
        elAlgorithm.removeChild(elAlgorithm.firstChild);
    }

    for (const alg of algorithm) {
        const elDiv = document.createElement("div");
        elAlgorithm.appendChild(elDiv);

        for (let i=0; i<alg.length; i++) {
            if (i>0 && i%6==0) {
                elDiv.appendChild(document.createTextNode(" "));
                const elSpan = document.createElement("span");
                elDiv.appendChild(elSpan);
                elSpan.classList.add("has-text-grey-light");
                elSpan.textContent = "-";
            }
            elDiv.appendChild(document.createTextNode((i==0?"":" ")+(alg[i]+1)));
        }
        elDiv.appendChild(document.createTextNode(" /"));
    }

    const elCards = elem("cards");
    while (elCards.firstChild) {
        elCards.removeChild(elCards.firstChild);
    }

    for (let card of cards) {
        const elCard = document.createElement("div");
        elCards.appendChild(elCard);

        elCard.classList.add("card_");

        const elDiv = document.createElement("div");
        elCard.appendChild(elDiv);

        if (config.face=="card" && card<52) {
            elCard.classList.add(["spade", "heart", "diamond", "club"][card/13|0]);

            elDiv.appendChild(document.createTextNode(
                ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][card%13]));
            elDiv.appendChild(document.createElement("br"));
            elDiv.appendChild(document.createTextNode(["♠", "♥", "♦", "♣"][card/13|0]));
        } else {
            elCard.classList.add("number");

            elDiv.textContent = ""+(card+1);
        }
    }
}

const config = loadConfig();

elem("number").value = ""+config.number;
for (const e of document.getElementsByName("face")) {
    if (e.value==config.face) {
        e.checked = true;
    }
}
if (config.showCards) {
    elem("show_cards").style.display = "none";
} else {
    elem("hide_cards").style.display = "none";
    elem("cards").style.display = "none";
}

function loadPermalink() {
    const url = new URL(window.location.href);
    if (!url.hash) {
        return false;
    }

    let number;
    let face;
    let seed;
    for (let e of url.hash.substring(1).split("&")) {
        const [k, v] = e.split("=");
        if (k=="number") {
            number = +v;
        }
        if (k=="face") {
            face = v;
        }
        if (k=="seed") {
            try {
                seed = BigInt(v);
            } catch {
            }
        }
    }

    if (number && 2<=number && number<=100 &&
        face && (face=="card" || face=="number") &&
        seed!==undefined && 0n<=seed) {
        return {
            number,
            face,
            seed,
        };
    } else {
        return false;
    }
}

let history = [makeSeed(config.number)];
let historyPosition = 0;
let isFromPermalink = false;

permalink = loadPermalink();

if (permalink) {
    elem("permalink_warning").style.display = "block";

    update({
        number: permalink.number,
        face: permalink.face,
    }, permalink.seed);
    isFromPermalink = true;
} else {
    update(config, history[historyPosition]);
}

// パーマリンク関連のものを削除する。
// 手順を生成し直す処理のときに呼ぶ。
function removePermalink() {
    if (isFromPermalink) {
        isFromPermalink = false;

        elem("permalink_warning").style.display = "none";

        const url = new URL(window.location.href);
        url.hash = "";
        window.history.replaceState(null, "", url.toString());
    }
}

elem("number").addEventListener("input", () => {
    const number = +elem("number").value;
    if (number!=config.number) {
        removePermalink();

        config.number = number;
        saveConfig(config);

        // 枚数が変わればseedの意味も変わるので履歴を削除。
        history = [makeSeed(config.number)];
        historyPosition = 0;
        elem("previous").disabled = true;
        update(config, history[historyPosition]);
    }
});

function inputFace(face) {
    if (face!=config.face) {
        removePermalink();

        config.face = face;
        saveConfig(config);
        update(config, history[historyPosition]);
    }
}

elem("face_card").addEventListener("input", () => {
    inputFace("card");
});

elem("face_number").addEventListener("input", () => {
    inputFace("number");
});

elem("reset").addEventListener("click", () => {
    removePermalink();

    config.number = 52;
    config.face = "card";
    config.showCards = true;
    saveConfig(config);

    elem("number").value = ""+config.number;
    for (const e of document.getElementsByName("face")) {
        if (e.value==config.face) {
            e.checked = true;
        }
    }
    if (config.showCards) {
        elem("show_cards").style.display = "none";
        elem("hide_cards").style.display = "inline-flex";
    } else {
        elem("show_cards").style.display = "inline-flex";
        elem("hide_cards").style.display = "none";
    }

    history = [makeSeed(config.number)];
    historyPosition = 0;
    elem("previous").disabled = true;
    update(config, history[historyPosition]);
});

elem("previous").addEventListener("click", () => {
    historyPosition--;
    if (historyPosition==0) {
        elem("previous").disabled = true;
    }
    update(config, history[historyPosition]);
});

elem("next").addEventListener("click", () => {
    if (isFromPermalink) {
        // 起動時に最初のシャッフルは生成しているので、パーマリンク関連のものを消して手順などを生成するだけで良い。
        removePermalink();
        update(config, history[historyPosition]);
        return;
    }

    historyPosition++;
    elem("previous").disabled = false;

    while (historyPosition>=history.length) {
        history.push(makeSeed(config.number));
    }

    update(config, history[historyPosition]);
});

elem("copy_permalink").addEventListener("click", () => {
    const type = "text/plain";
    const blob = new Blob([elem("permalink").href], {type});
    const data = [new ClipboardItem({[type]: blob})];
    navigator.clipboard.write(data);
});

elem("show_cards").addEventListener("click", () => {
    config.showCards = true;
    saveConfig(config);

    elem("show_cards").style.display = "none";
    elem("hide_cards").style.display = "inline-flex";
    elem("cards").style.display = "flex";
});

elem("hide_cards").addEventListener("click", () => {
    config.showCards = false;
    saveConfig(config);

    elem("show_cards").style.display = "inline-flex";
    elem("hide_cards").style.display = "none";
    elem("cards").style.display = "none";
});
