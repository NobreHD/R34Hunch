(async () => {
    const page = $('.web');

    // Utils
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const smoothCount = async (amount, callback) => {
        let exponent = parseInt(amount.toExponential().split('+')[1]);
        let current = 0;
        while(current < amount){
            current += Math.ceil(amount / (exponent * 4));
            if(current > amount) current = amount;
            callback(current);
            await wait(30);
        }
    }

    // Cookies
    const cookieStorage = (() => {
        const set = (key, value) => document.cookie = `${key}=${value}; path=/`;
        
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

    // VS Control
    const vs = (()=>{
        const vsElement = page.find('.vs');
        const vsText = vsElement.find('span');

        const showResult = (result) => {
            if (result) {
                vsElement.addClass('correct');
                vsText.text('✔');
            } else {
                vsElement.addClass('wrong');
                vsText.text('✘');
            }
        }

        const reset = () => {
            vsElement.removeClass('correct wrong');
            vsText.text('VS');
        }

        return {
            showResult,
            reset
        }
    })();

    // Streamer Mode
    (()=>{
        const streamerModeElement = page.find('#stream-mode');
        const label = page.find('#stream-mode-label');
        let timer;
        
        const set = (value) => {
            cookieStorage.set('stream-mode', value);
            if(value) page.addClass('blur');
            else page.removeClass('blur');
        }

        streamerModeElement.on("change", () => {
            if (timer) {
                page.addClass('no-images');
                streamerModeElement.prop('disabled', true);
                streamerModeElement.off('change');
                streamerModeElement.prop('checked', true);
                label.text('No Image Mode');
                return;
            }
            timer = setTimeout(() => {
                clearTimeout(timer);
                timer = null;
            }, 500);
            set(streamerModeElement.is(':checked'));
        });

        if(cookieStorage.get('stream-mode') == 'true'){
            streamerModeElement.prop('checked', true);
            set(true);
        }
    })();

    // Game Control
    const game = (()=>{
        // Game Elements
        const gameContainer = page.find('.game-container');

        // Game Variables
        let score = 0;
        let previousTags = [];
        let currentItems = [];
        let loading = false;

        // API Access
        const getGameEntry = async () => {
            const streamer_mode = cookieStorage.get('stream-mode') == 'true';
            const ids = currentItems.map(item => item.id);
            while(true){
                try{
                    let response = await fetch('https://api.nobrehd.pt/r34', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            tags: previousTags,
                            ids,
                            streamer_mode
                        })
                    });
                    return await response.json();
                }catch(e){
                    console.error(e);
                    await wait(500);
                }
            }
        }

        const staticImage = async (url) => {
            return url;
            // Fuck CORS 
            // return new Promise((resolve, reject) => {
            //     const img = new Image();
            //     img.onload = () => {
            //         const canvas = document.createElement('canvas');
            //         const context = canvas.getContext('2d');
            //         canvas.width = img.width;
            //         canvas.height = img.height;
            //         context.drawImage(img, 0, 0);
            //         resolve(canvas.toDataURL());
            //     }
            //     img.onerror = () => reject();
            //     img.src = url;
            // });
        }

        // Convert to HTML
        const convertToHTML = async (item, i) => {
            const streamer_mode = cookieStorage.get('stream-mode') == 'true';
            const countHTML = `<p class="count">${(i !== 0)?'':item.count.toLocaleString()}</p>`;	
            const extraHTML = (i !== 0)?`
                <div class="ask">
                        <div class="options flexccc">
                        <div class="option" data-value="true">More ▲</div>
                        <div class="option" data-value="false">Fewer ▼</div>
                    </div>
                    <span>posts than ${currentItems[i-1].tag.replace(/_/g, ' ')}</span>
                </div>`:'';
            const sourceHTML = (streamer_mode) ? "" : [...item.source, item.url].map(source => `<a href="${source}" target="_blank">${source}</a>`).join('<br>');
            const imageURL = (streamer_mode) ? await staticImage(item.image) : item.image;
            return `
                <div class="item">
                    <img src="${imageURL}" alt="${item.tag}" fetchpriority="low">
                    <div class="item-data full-abs flexccc">
                        <p>${item.tag.replace(/_/g, ' ')}</p>
                        <span>has</span>
                        <div class="pop flexccc ${i === 0?'':'hidden'}">
                            ${countHTML}
                        </div>
                        ${extraHTML}    
                    </div>
                    <div class="item-source">${sourceHTML}</div>
                </div>
            `;
        }

        // Convert to Element
        const convertToElement = async (item, i) => {
            const element = $(await convertToHTML(item, i));
            element.find('.option').click(async (e) => {
                element.find(".ask").remove();
                element.find(".pop").removeClass('hidden');
                await smoothCount(item.count, (current) => {
                    element.find('.count').text(current.toLocaleString());
                });
                let result = $(e.target).data('value') 
                    ? currentItems[0].count <= item.count 
                    : currentItems[0].count >= item.count;
                vs.showResult(result);
                await wait(1000);
                if(result) await game.next();
                else await game.reset();
            });
            return element;
        }

        // Next
        const next = async () => {
            score++;
            const entry = await getGameEntry();
            previousTags.push(entry.tag);
            if (previousTags.length > 40) previousTags.shift();
            currentItems.push(entry);
            currentItems.shift();
            const element = await convertToElement(entry, 2);
            gameContainer.animate({
                marginLeft: '-50%'
            }, 500, () => {
                gameContainer.css('margin-left', '0');
                gameContainer.append(element);
                gameContainer.children().first().remove();
                vs.reset();
            });
        }

        // Reset
        const reset = async () => {
            page.find('.lose .count').text(score);
            page.find('.game').fadeOut(500);
            vs.reset();
            score = 0;
            previousTags = [];
            currentItems = [];
            gameContainer.empty();
            await game.load();
        }

        // Load
        const load = async () => {
            loading = true;
            for(let i = 0; i < 3; i++){
                const entry = await getGameEntry();
                previousTags.push(entry.tag);
                currentItems.push(entry);
                gameContainer.append(await convertToElement(entry, i));
            }
            loading = false;
        }

        // Wait for load
        const waitForLoad = async () => {
            while(loading) await wait(100);
        }

        return {
            next,
            reset,
            load,
            waitForLoad
        }
    })();

    // Buttons
    (()=>{
        const startButton = page.find('#start-btn');

        if ($(window).width() < 768) {
            startButton.text('Still not mobile friendly');
            startButton.prop('disabled', true);
        } else {
            startButton.click(async () => { 
                await game.waitForLoad();
                $('.start').fadeOut(500);
            });
        }

        page.find('#restart-btn').click(async () => {
            await game.waitForLoad();
            page.find('.game').fadeIn(500);
        });

        $('#continue-btn').click(() => {
            cookieStorage.set('warning', 'true');
            $('.warning').fadeOut(500);
        });
    })();

    // Load
    $('.loading').fadeOut(500);
    if(cookieStorage.get('warning') != 'true') $('.warning').show();

    await game.load();
})();
