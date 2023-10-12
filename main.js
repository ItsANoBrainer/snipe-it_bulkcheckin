const Config = require("./config.json");
const doPrompt = require("prompt-sync")({ sigint: true });
const fs = require("fs");
const axios = require("axios").default;
const Papa = require("papaparse")

main()
async function main() {
    GrabArguments()

    logLine("=")
    log(`[Log] Starting Snipe-IT Bulk Checkin by ItsANoBrainer.`)
    prompt(`[Log] Press enter to begin. This will checkin everything inside '${Config.inputFile}': `)

    if (Config.snipeitURL.length == 0) return log("[Error] No Snipe-IT URL set in the config file.")
    if (Config.apiKey.length == 0) return log("[Error] No API Key set in the config file.")
    if (!fs.existsSync(Config.inputFile)) return log(`[Error] Input file '${Config.inputFile}' not found.`)

    let csvData = [];
    Papa.parse(fs.createReadStream(Config.inputFile), {
        header: true,
        dynamicTyping: true,
        step: function (result) {
            csvData.push(result.data)
        },
        complete: function () {
            const checkinType = Object.keys(csvData[0])[0].toLowerCase()
            if (Config.validTypes.includes(checkinType)) {
                log(`[Checkin] Found ${csvData.length} record(s) to checkin by ${checkinType}.`);
                logLine("-")
                if (csvData.length > 0) startCheckinProcess(csvData, checkinType)
            } else {
                log(`[Error] Invalid type in header row column 1. ${checkinType} ${Config.validTypes.includes(checkinType)} ${Config.validTypes}`)
            }
        }
    });

    logLine("=")
}

function GrabArguments() {
    const myArgs = process.argv.slice(2);
    const boolArgs = ["verbose", "allowPrompt"]

    Object.keys(Config).forEach((key) => {
        if (myArgs.includes(`-${key}`)) {
            let newConfig = myArgs[myArgs.indexOf(`-${key}`) + 1]
            if (boolArgs.includes(key)) newConfig = (newConfig == "true")
            Config[key] = newConfig
        }
    })
}

function log(msg, verbose) { if (!verbose || (verbose && Config.verbose)) console.log(msg) }
function logLine(type) { log(type.repeat(100)) }
function prompt(msg) { if (Config.allowPrompt) doPrompt(msg) }

async function startCheckinProcess(csvData, checkinKey) {
    const startTime = new Date().getTime()

    const { errors, successes } = await batchCheckin(csvData, checkinKey)

    console.log('----------------------------------------------------------------------------------------------------')
    console.log(`${successes}/${csvData.length} items were checked in.`)
    console.log('----------------------------------------------------------------------------------------------------')
    console.log(`The follow items had errors:`)

    let finalErrors = []
    for (const [key, value] of Object.entries(errors)) {
        let errorString = `- ${key.replace('.', '')}: `;
        errors[key].forEach((item, index) => {
            errorString += item
            if (Object.entries(errors[key]).length - 1 != index) {
                errorString += ', '
            }
        })
        finalErrors.push(errorString)
        console.log(errorString);
    }

    fs.writeFileSync('errors.txt', finalErrors.join('\n'))

    const endTime = new Date().getTime()
    logLine("-")
    log(`[Log] Completed in ${msToTimeLength(endTime - startTime)}`)
    logLine("=")
    prompt(`[Log] Press enter to finish...`)
}

async function batchCheckin(csvData, checkinKey) {
    let batch = 0
    let batchCount = Math.ceil(csvData.length / Config.batchSize)
    let batchStart = 0
    let batchEnd = Config.batchSize

    let errors = {}
    let successes = 0
    let unfulfilled = 0
    while (batch < batchCount) {
        console.log(`Batch ${batch + 1}/${batchCount} | Devices ${batchStart + 1}-${Math.min(batchEnd, csvData.length)} of ${csvData.length}`)

        const batchResults = await Promise.allSettled(csvData.slice(batchStart, batchEnd).map(async entry => {
            return await processCheckin(checkinKey, entry)
        }))

        batchResults.forEach((result, index, array) => {
            const value = result.value
            if (result.status != "fulfilled") {
                const entry = csvData[batchStart + index]
                result.value = { id: entry.id, ['asset_tag']: entry['asset_tag'], status: 'error', message: 'Request was not fulfilled.' }
                unfulfilled++
            }

            if (value.status == 'error') {
                if (!errors[value['message']]) { errors[value['message']] = [] }
                errors[value['message']].push(value.entry[value.checkinKey])
            } else {
                successes++
            }
        })

        batch++
        batchStart += Config.batchSize
        batchEnd += Config.batchSize
    }

    return { errors: errors, successes: successes, unfulfilled: unfulfilled }
}

function processCheckin(checkinKey, entry) {
    return new Promise(async resolve => {
        switch (checkinKey) {
            case "asset_tag":
                entry.id = await getAssetID(`bytag`, entry[checkinKey])
                break;
            case "serial_number":
                entry.id = await getAssetID(`byserial`, entry[checkinKey])
                break;
        }

        let assetCheckin;
        if (entry.id != "Not Found") assetCheckin = await checkinAssetID(parseInt(entry.id), entry.note)
        else assetCheckin = { status: "error", message: `${checkinKey} not found` }

        assetCheckin.checkinKey = checkinKey
        assetCheckin.entry = entry

        resolve(assetCheckin)
    });
}

function checkinAssetID(id, note) {
    return new Promise((resolve, reject) => {
        let options = {
            method: "POST",
            url: `${Config.snipeitURL}/api/v1/hardware/${id}/checkin`,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Config.apiKey}` },
            data: { "note": note }
        };

        axios.request(options).then(function (response) {
            const data = response.data
            resolve({ "id": id, "asset tag": data.payload?.asset, "status": data.status, "message": data.messages })
        }).catch(function (error) {
            reject(error)
        });
    });
}

function getAssetID(type, identifier) {
    return new Promise((resolve, reject) => {
        let options = {
            method: "GET",
            url: `${Config.snipeitURL}/api/v1/hardware/${type}/${identifier}`,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Config.apiKey}` },
        };
        axios.request(options).then(function (response) {
            resolve(response.data.id || response.data?.rows?.[0]?.id || "Not Found")
        }).catch(function (error) {
            reject(error)
        });
    });
}

function msToTimeLength(ms) {
    // Hours, minutes and seconds
    let hrs = ~~(ms / 3600000);
    let mins = ~~((ms % 3600000) / 60000);
    let secs = ~~(((ms % 360000) % 60000) / 1000);

    // Output like "1:01" or "4:03:59" or "123:03:59"
    let ret = "";

    if (hrs > 0) ret += "" + hrs + ":" + (mins < 10 ? "0" : "");

    ret += "" + mins + ":" + (secs < 10 ? "0" : "");
    ret += "" + secs;
    return ret;
}