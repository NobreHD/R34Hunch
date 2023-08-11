(async () => {
    const page = $('.web');
    const start = $('.start');
    const startBtn = $('#start-btn');
    const streamMode = $('#stream-mode');
    const gameSlider = $('.game-slider');
    const gameContainer = $('.game-container');

    const cookieStorage = (() => {
        const set = (key, value) => {
            document.cookie = `${key}=${value}; path=/`;
        }

        const get = (key) => {
            const cookies = document.cookie.split(';');
            for(let cookie of cookies){
                const [cookieKey, cookieValue] = cookie.split('=');
                if(cookieKey.trim() == key) return cookieValue;
            }
            return undefined;
        }

        return {
            set,
            get
        }
    })();

    if (cookieStorage.get('warning') == undefined) {
        $('.warning').show();
    }

    $('#continue-btn').click(() => {
        cookieStorage.set('warning', true);
        $('.warning').fadeOut(500);
    });

    $('#restart-btn').click(() => {
        $('.game').fadeIn(500);
    });

    let countWon = 0;

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const getSize = (count) => {
        let countCopy = count;
        let size = 0;
        while(countCopy > 1){
            countCopy /= 10;
            size++;
        }
        return size;
    }

    const countUpTo = async (count, element) => {
        let countUp = 0;
        let size = getSize(count);
        while(countUp < count){
            countUp += Math.ceil(count / (size * 4));
            if(countUp > count) countUp = count;
            await wait(30);
            element.text(countUp.toLocaleString());
        }
    }

    const showVS = (won) => {
        const vs = $('.vs');
        const vsSpan = vs.find('span');
        if(won) {
            vs.addClass('correct');
            vsSpan.text('✔');
        }else{
            vs.addClass('wrong');
            vsSpan.text('✖');                 
        }
    }

    const resetVS = () => {
        const vs = $('.vs');
        vs.removeClass('correct');
        vs.removeClass('wrong');
        vs.find('span').text('VS');
    }

    if(cookieStorage.get('stream-mode') == 'true'){
        $("#stream-mode").prop('checked', true);
        page.addClass('blur');
    }

    startBtn.click(() => {
        start.fadeOut(500);
    });

    if ($(window).width() < 768) {
        startBtn.addClass('disabled');
        startBtn.text('Please use a bigger screen .-.');
        startBtn.off('click');
    }

    const gameItems = await (async () => {
        let items = [];
        let tags = [];

        const get = async () => {
            const ids = items.map(item => item.id);
            let response = null;
            while(true){
                response = await fetch('https://api.nobrehd.pt/r34', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tags,
                        ids,
                        stream_mode: cookieStorage.get('stream-mode') == 'true'
                    })
                });
                if(response.status == 200) break;
                await wait(1000);
            }
            return await response.json();
        }

        const itemToElement = (item, i) => {
            const extra = i == -1 ? ` 
                <div class="pop flexccc">
                    <p class="count">${item.count.toLocaleString()}</p>
                    <span>posts</span>
                </div>` : `
                <div class="pop hidden flexccc">
                    <p class="count"></p>
                    <span>posts</span>
                </div>
                <div class="ask">
                    <div class="options flexccc">
                        <div class="option" data-value="true">More ▲</div>
                        <div class="option" data-value="false">Less ▼</div>
                    </div>
                    <span>posts than ${items[i].tag.replace(/_/g, ' ')}</span>
                </div>`;

            const links = [...item.source]
            links.push(item.url)
            const source = links.map(source => `<a href="${source}" target="_blank">${source}</a>`);

            const element = $(`<div class="item">
                <img src="${item.image}" alt="">
                <div class="item-data full-abs flexccc">
                    <p>${item.tag.replace(/_/g, ' ')}</p>
                    <span>has</span>
                    ${extra}
                </div>
                <div class="item-source">
                    ${source.join('<br>')}
                </div>
            </div>`);

            element.find(".option").click(async (event)=>{
                element.find('.ask').remove();
                element.find('.pop').removeClass('hidden');
                await countUpTo(item.count, element.find('.count'));
                const won = gameItems.check(event.target.dataset.value == 'true');
                await wait(1000);
                showVS(won);
                await wait(1000);
                if (won) {
                    countWon++;
                    let element = await gameItems.newItem();
                    gameContainer.animate({
                        marginLeft: '-50%'
                    }, 300, () => {
                        gameContainer.css('margin-left', '0');
                        gameContainer.append(element);
                        gameContainer.children().first().remove();
                        resetVS();
                    });
                } else {
                    $('.lose .count').text(countWon);
                    $('.game').fadeOut(500);
                    await wait(500);
                    countWon = 0;
                    gameItems.reset();
                    resetVS();
                }
            });

            return element;
        }

        const load = async () => {
            for(let i = 0; i < 3; i++){
                let data = await get();
                items.push(data);
                gameContainer.append(itemToElement(data, i-1));
            }
        }

        await load();

        const reset = async () => {
            items = [];
            tags = [];
            gameContainer.empty();
            await load();
        }

        const newItem = async () => {
            item = await get();
            tags.push(item.tag);
            if (tags.length > 30) tags.shift();
            items.push(item);
            items.shift();
            return itemToElement(item, 1);
        }

        const check = (guess) => {
            if (!guess) return items[0].count >= items[1].count;
            else return items[0].count <= items[1].count;
        }

        return {
            newItem,
            check,
            reset
        }
    })();

    streamMode.on('change', () => {
        if(streamMode.is(':checked')){
            page.addClass('blur');
            cookieStorage.set('stream-mode', true);
        }else{
            page.removeClass('blur');
            cookieStorage.set('stream-mode', false);
        }
    });

    $('.vs').click(async() => {
        let element = await gameItems.newItem();
        gameContainer.animate({
            marginLeft: '-50%'
        }, 300, () => {
            gameContainer.css('margin-left', '0');
            gameContainer.append(element);
            gameContainer.children().first().remove();
        });
    });

    $('.loading').fadeOut(500);
})();