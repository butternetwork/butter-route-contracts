let { readFromFile, writeToFile } = require("../../utils/create.js");
let { getTronWeb, deploy_contract } = require("./tronUtils.js");

exports.routerV2 = async function (artifacts, network, config) {
    let tronWeb = await getTronWeb(network);
    let router = await deployRouter("ButterRouterV2", artifacts, network, config.v2.mos, config.wToken);
    let deploy = await readFromFile(network);
    let adapt = deploy[network]["SwapAdapter"];
    config.v2.executors.push(tronWeb.address.toHex(adapt).replace(/^(41)/, "0x"));
    let executors_s = config.v2.executors.join(",");
    await setAuthorization("ButterRouterV2", tronWeb, artifacts, network, router, executors_s, true);
    await setFee(
        "ButterRouterV2",
        tronWeb,
        artifacts,
        network,
        router,
        config.v2.fee.receiver,
        config.v2.fee.feeRate,
        config.v2.fee.fixedFee
    );
};

exports.routerV3 = async function (artifacts, network, config) {
    let tronWeb = await getTronWeb(network);
    let router = await deployRouter("ButterRouterV3", artifacts, network, config.v3.bridge, config.wToken);
    let deploy = await readFromFile(network);
    let adapt = deploy[network]["SwapAdapter"];
    config.v3.executors.push(tronWeb.address.toHex(adapt).replace(/^(41)/, "0x"));
    let executors_s = config.v3.executors.join(",");
    await setAuthorization("ButterRouterV3", tronWeb, artifacts, network, router, executors_s, true);
    await setFee(
        "ButterRouterV3",
        tronWeb,
        artifacts,
        network,
        router,
        config.v3.fee.receiver,
        config.v3.fee.feeRate,
        config.v3.fee.fixedFee
    );
   await setReferrerMaxFee(artifacts, network, router, config.v3.fee.maxFeeRate, config.v3.fee.maxNativeFee);
};

exports.deployFeeReceiver = async function (artifacts, network, payees, shares) {
    let tronWeb = await getTronWeb(network);
    let deployer = "0x" + tronWeb.defaultAddress.hex.substring(2);
    console.log("deployer :", tronWeb.address.fromHex(deployer));
    let feeReveiver = await deploy_contract(artifacts, "FeeReceiver", [payees, shares, deployer], tronWeb);
    console.log("FeeReceiver address :", feeReveiver);
    let deploy = await readFromFile(network);
    deploy[network]["FeeReceiver"] = feeReveiver;
    await writeToFile(deploy);
};

exports.deployRouterV2 = async function (artifacts, network, mos, wtoken) {
    await deployRouter("ButterRouterV2", artifacts, network, mos, wtoken);
};

exports.deployRouterV3 = async function (artifacts, network, bridge, wtoken) {
    await deployRouter("ButterRouterV3", artifacts, network, bridge, wtoken);
};

exports.deploySwapAdapter = async function (artifacts, network) {
    await deploySwapAdapter(artifacts, network);
};

exports.tronSetAuthorizationV2 = async function (artifacts, network, router_addr, executors, flag) {
    let tronWeb = await getTronWeb(network);
    await setAuthorization("ButterRouterV2", tronWeb, artifacts, network, router_addr, executors, flag);
};

exports.tronSetAuthorizationV3 = async function (artifacts, network, router_addr, executors, flag) {
    let tronWeb = await getTronWeb(network);
    await setAuthorization("ButterRouterV3", tronWeb, artifacts, network, router_addr, executors, flag);
};
async function setAuthorization(contractName, tronWeb, artifacts, network, router_addr, executors, flag) {
    let Router = await artifacts.readArtifact(contractName);
    if (router_addr.startsWith("0x")) {
        router_addr = tronWeb.address.fromHex(router_addr);
    }
    let router = await tronWeb.contract(Router.abi, router_addr);
    let executorList = executors.split(",");
    if (executorList.length < 1) {
        console.log("executors is empty ...");
        return;
    }
    let executorsHex = [];
    for (let i = 0; i < executorList.length; i++) {
        executorsHex.push(tronWeb.address.toHex(executorList[i]).replace(/^(41)/, "0x"));
    }
    await router.setAuthorization(executorsHex, flag).send();
    console.log(`${contractName} ${router_addr} setAuthorization ${executorList} succeed`);
}

exports.tronSetFeeV2 = async function (artifacts, network, router_addr, feereceiver, feerate, fixedfee) {
    let tronWeb = await getTronWeb(network);
    await setFee("ButterRouterV2", tronWeb, artifacts, network, router_addr, feereceiver, feerate, fixedfee);
};

exports.tronSetFeeV3 = async function (artifacts, network, router_addr, feereceiver, feerate, fixedfee) {
    let tronWeb = await getTronWeb(network);
    await setFee("ButterRouterV3", tronWeb, artifacts, network, router_addr, feereceiver, feerate, fixedfee);
};

exports.tronSetBridge = async function (artifacts, network, router_addr, bridge) {
    let tronWeb = await getTronWeb(network);
    await setBridge("ButterRouterV3", tronWeb, artifacts, network, bridge);
};

exports.tronSetReferrerMaxFee = async function (artifacts, network, router_addr, maxFeeRate, maxNativeFee) {
    await setReferrerMaxFee(artifacts, network, router_addr, maxFeeRate, maxNativeFee);
};

async function setReferrerMaxFee(artifacts, network, router_addr, maxFeeRate, maxNativeFee) {
    let tronWeb = await getTronWeb(network);
    let Router = await artifacts.readArtifact("ButterRouterV3");
    if (router_addr.startsWith("0x")) {
        router_addr = tronWeb.address.fromHex(router_addr);
    }
    let router = await tronWeb.contract(Router.abi, router_addr);
    await router.setReferrerMaxFee(maxFeeRate, maxNativeFee).send();
}

exports.tronSetFeeManager = async function (artifacts, network, router_addr, manager) {
    let tronWeb = await getTronWeb(network);
    let Router = await artifacts.readArtifact("ButterRouterV3");
    if (router_addr.startsWith("0x")) {
        router_addr = tronWeb.address.fromHex(router_addr);
    }
    let router = await tronWeb.contract(Router.abi, router_addr);

    let manager_hex = tronWeb.address.toHex(manager).replace(/^(41)/, "0x");

    await router.setFeeManager(manager_hex).send();
};

async function setFee(contractName, tronWeb, artifacts, network, router_addr, feereceiver, feerate, fixedfee) {
    let Router = await artifacts.readArtifact(contractName);
    if (router_addr.startsWith("0x")) {
        router_addr = tronWeb.address.fromHex(router_addr);
    }
    let router = await tronWeb.contract(Router.abi, router_addr);

    let receiver = tronWeb.address.toHex(feereceiver).replace(/^(41)/, "0x");

    await router.setFee(receiver, feerate, fixedfee).send();

    console.log(
        `${contractName} ${router_addr} setFee rate(${feerate}), fixed(${fixedfee}), receiver(${feereceiver}) succeed`
    );
}

async function setBridge(contractName, tronWeb, artifacts, network, router_addr, bridge) {
    let Router = await artifacts.readArtifact(contractName);
    if (router_addr.startsWith("0x")) {
        router_addr = tronWeb.address.fromHex(router_addr);
    }
    let router = await tronWeb.contract(Router.abi, router_addr);

    let bridgeHex = tronWeb.address.toHex(bridge).replace(/^(41)/, "0x");

    await router.setBridge(bridgeHex).send();

    console.log(`${contractName} ${router_addr} set bridge (${bridge}) succeed`);
}

async function deployRouter(contractName, artifacts, network, mosOrBridge, wtoken) {
    let tronWeb = await getTronWeb(network);
    console.log(`deploy ${contractName} ...`);
    console.log("deployer :", tronWeb.defaultAddress);

    let deployer = tronWeb.defaultAddress.hex.replace(/^(41)/, "0x");
    let mosOrBridgeHex = tronWeb.address.toHex(mosOrBridge).replace(/^(41)/, "0x");
    let wtokenHex = tronWeb.address.toHex(wtoken).replace(/^(41)/, "0x");

    let router = await deploy_contract(artifacts, contractName, [mosOrBridgeHex, deployer, wtokenHex], tronWeb);
    console.log(`${contractName} :`, router);

    let deploy = await readFromFile(network);
    if (!deploy[network][contractName]) {
        deploy[network][contractName] = {};
    }
    deploy[network][contractName]["addr"] = router;
    await writeToFile(deploy);

    return router;
}

async function deploySwapAdapter(artifacts, network) {
    console.log("deploy swap adapter ...");

    let tronWeb = await getTronWeb(network);
    let deployer = tronWeb.defaultAddress.base58;
    console.log("deployer :", deployer);
    let adapt = await deploy_contract(artifacts, "SwapAdapter", [deployer], tronWeb);
    console.log("SwapAdapter address :", adapt);
    let deploy = await readFromFile(network);
    deploy[network]["SwapAdapter"] = adapt;
    await writeToFile(deploy);
    return adapt;
}

exports.tronSetAuthFromConfigV2 = async function (artifacts, network, router_addr, config) {
    let deploy_json = await readFromFile(network);
    if (router_addr === "router") {
        if (deploy_json[network]["ButterRouterV2"] === undefined) {
            throw "can not get router address";
        }
        router_addr = deploy_json[network]["ButterRouterV2"]["addr"];
    }
    console.log("router: ", router_addr);

    let adapter_address = deploy_json[network]["SwapAdapter"];
    if (adapter_address != undefined) {
        console.log("SwapAdapter: ", adapter_address);
        config.v2.executors.push(adapter_address);
    }
    let tronWeb = await getTronWeb(network);
    let Router = await artifacts.readArtifact("ButterRouterV2");
    if (router_addr.startsWith("0x")) {
        router_addr = tronWeb.address.fromHex(router_addr);
    }
    let router = await tronWeb.contract(Router.abi, router_addr);
    let executors = [];
    for (let i = 0; i < config.v2.executors.length; i++) {
        let result = await await router.approved(config.v2.executors[i]).call();

        if (result === false || result === undefined) {
            executors.push(config.v2.executors[i]);
        }
    }
    if (executors.length > 0) {
        let executors_s = executors.join(",");

        console.log("routers to set :", executors_s);

        await setAuthorization(tronWeb, artifacts, network, router_addr, executors_s, true);
    }
    console.log("RouterV2 sync authorization from config file.");
};

exports.tronCheckAndUpdateFromConfig = async function (artifacts, network, router_addr, config) {
    let deploy_json = await readFromFile(network);
    if (router_addr === "router") {
        if (deploy_json[network]["ButterRouterV3"] === undefined) {
            throw "can not get router address";
        }
        router_addr = deploy_json[network]["ButterRouterV3"]["addr"];
    }
    console.log("router: ", router_addr);

    let adapter_address = deploy_json[network]["SwapAdapter"];
    if (adapter_address != undefined) {
        console.log("SwapAdapter: ", adapter_address);
        config.v3.executors.push(adapter_address);
    }
    let tronWeb = await getTronWeb(network);
    let Router = await artifacts.readArtifact("ButterRouterV3");
    if (router_addr.startsWith("0x")) {
        router_addr = tronWeb.address.fromHex(router_addr);
    }
    let router = await tronWeb.contract(Router.abi, router_addr);
    await checkAuthorization(router, config, tronWeb, artifacts, network, router_addr);
    await checkFee(router, config);
    await checkBridgeAndWToken(router, config);
};

async function checkAuthorization(router, config, tronWeb, artifacts, network, router_addr) {
    let executors = [];
    for (let i = 0; i < config.v3.executors.length; i++) {
        let result = await router.approved(config.v3.executors[i]).call();

        if (result === false || result === undefined) {
            executors.push(config.v3.executors[i]);
        }
    }
    if (executors.length > 0) {
        let executors_s = executors.join(",");

        console.log("routers to set :", executors_s);

        await setAuthorization("ButterRouterV3",tronWeb, artifacts, network, router_addr, executors_s, true);
    }
    console.log("RouterV3 sync authorization from config file.");
}

async function checkFee(router, config) {
    let feeReceiver = await router.feeReceiver().call();
    let routerFixedFee = await router.routerFixedFee().call();
    let routerFeeRate = await router.routerFeeRate().call();

    console.log("pre feeReceiver", tronWeb.address.fromHex(feeReceiver));
    console.log("pre routerFixedFee", routerFixedFee);
    console.log("pre routerFeeRate", routerFeeRate);
    let hexReceiver = tronWeb.address.toHex(config.v3.fee.receiver).replace(/^(41)/, "0x");
    if (
        feeReceiver.toLowerCase() !== hexReceiver.toLowerCase() ||
        routerFixedFee !== config.v3.fee.routerFixedFee ||
        routerFeeRate !== config.v3.fee.routerFeeRate
    ) {
        await router.setFee(hexReceiver, config.v3.fee.routerFeeRate, config.v3.fee.routerFixedFee).send();
        console.log("feeReceiver", tronWeb.address.fromHex(await router.feeReceiver().call()));
        console.log("routerFixedFee", await router.routerFixedFee().call());
        console.log("routerFeeRate", router.routerFeeRate().call());
    }
    let maxFeeRate = await router.maxFeeRate().call();
    let maxNativeFee = await router.maxNativeFee().call();
    console.log("pre maxFeeRate", maxFeeRate);
    console.log("pre maxNativeFee", maxNativeFee);
    if (maxFeeRate !== config.v3.fee.maxFeeRate || maxNativeFee !== config.v3.fee.maxNativeFee) {
       await router.setReferrerMaxFee(config.v3.fee.maxFeeRate, config.v3.fee.maxNativeFee).send();
        console.log("maxFeeRate", await router.maxFeeRate().call());
        console.log("maxNativeFee", await router.maxNativeFee().call());
    }
}

async function checkBridgeAndWToken(router, config) {
    let wToken = await router.wToken().call();

    console.log("pre wToken", tronWeb.address.fromHex(wToken));
    let hexWToken = tronWeb.address.toHex(config.wToken).replace(/^(41)/, "0x");
    if (wToken.toLowerCase() !== hexWToken.toLowerCase()) {
        await router.setWToken(hexWToken).send();
        console.log("wToken", tronWeb.address.fromHex(await router.wToken().call()));
    }

    let bridgeAddress = await router.bridgeAddress().call();
    console.log("pre bridgeAddress", tronWeb.address.fromHex(bridgeAddress));
    let hexbridgeAddress = tronWeb.address.toHex(config.v3.bridge).replace(/^(41)/, "0x");
    if (bridgeAddress.toLowerCase() !== hexbridgeAddress.toLowerCase()) {
        await router.setBridgeAddress(hexbridgeAddress).send();
        console.log("bridgeAddress", tronWeb.address.fromHex(await router.bridgeAddress().call()));
    }
}
