/* global it:false, describe:false */

import assert from 'assert';
import bitcoin from 'bitcoinjs-lib-zcash';

import {startBitcore} from '../test_helpers/common.js';
import {WorkerChannel} from '../lib/utils/simple-worker-channel';
import {BitcoreBlockchain} from '../lib/bitcore';
import {WorkerDiscovery} from '../lib/discovery/worker-discovery';

// hack for workers in both node and browser
const socketWorkerFactory = () => {
    if (typeof Worker === 'undefined') {
        const TinyWorker = require('tiny-worker');
        return new TinyWorker(() => {
            require('babel-register');
            require('../../../lib/socketio-worker/inside.js');
        });
    } else {
        return new Worker('../../lib/socketio-worker/inside.js');
    }
};

const discoveryWorkerFactory = () => {
    if (typeof Worker === 'undefined') {
        const TinyWorker = require('tiny-worker');
        return new TinyWorker(() => {
            require('babel-register');
            // Terrible hack
            // Browserify throws error if I don't do this
            // Maybe it could be fixed with noParse instead of eval, but I don't know how,
            // since this is all pretty hacky anyway
            // eslint-disable-next-line no-eval
            const requireHack = eval('req' + 'uire');
            requireHack('../../../lib/discovery/worker/inside/index.js');
        });
    } else {
        return new Worker('../../lib/discovery/worker/inside/index.js');
    }
};

const cryptoWorkerFactory = () => {
    if (typeof Worker === 'undefined') {
        const TinyWorker = require('tiny-worker');
        return new TinyWorker(() => {
            // Terrible hack
            // Browserify throws error if I don't do this
            // Maybe it could be fixed with noParse instead of eval, but I don't know how,
            // since this is all pretty hacky anyway
            // eslint-disable-next-line no-eval
            const requireHack = eval('req' + 'uire');
            requireHack('../../../lib/trezor-crypto/emscripten/trezor-crypto.js');
        });
    } else {
        return new Worker('../../lib/trezor-crypto/emscripten/trezor-crypto.js');
    }
};

const cryptoWorker = cryptoWorkerFactory();
const addressChannel = new WorkerChannel(cryptoWorker);

function testDiscovery(discovery, done, xpub, testfun) {
    const stream = discovery.discoverAccount(
        null,
        xpub,
        bitcoin.networks.testnet,
        'off'
    );
    stream.ending.then((res) => {
        if (testfun(res)) {
            done();
        } else {
            done(new Error('Test not satisfied.'));
        }
    }, (e) => done(e));
}

describe('discovery', () => {
    describe('constructor', () => {
        let discovery;

        it('starts bitcore', function () {
            this.timeout(60 * 1000);
            return startBitcore();
        });

        it('creates something', () => {
            const blockchain = new BitcoreBlockchain(['http://localhost:3005'], socketWorkerFactory);
            discovery = new WorkerDiscovery(discoveryWorkerFactory, addressChannel, blockchain);
            assert.ok(discovery);
        });

        it('does some discovery', function (done) {
            this.timeout(60 * 1000);
            const xpub = 'tprv8hfY7uEoozgCAdFuTmhxnzM5fxDqoNe1AkeMCiKJ3NqJVzi6d5vQJhPsLdTnenmKNMobAM5Znrm3LEswj7GV1mBGm28DH4zVfcvBkYbTGqR';
            testDiscovery(discovery, done, xpub, () => true);
        });

        it('returns empty on empty account', function (done) {
            this.timeout(60 * 1000);
            const xpub = 'tprv8hfY7uEoozgCAdFuTmhxnzM5fxDqoNe1AkeMCiKJ3NqJVzi6d5vQJhPsLdTnenmKNMobAM5Znrm3LEswj7GV1mBGm28DH4zVfcvBkYbTGqR';
            testDiscovery(discovery, done, xpub, (info) => {
                if (info.utxos.length !== 0) {
                    return false;
                }
                if (info.usedAddresses.length !== 0) {
                    return false;
                }
                if (info.changeAddresses.length !== 20) {
                    return false;
                }
                if (info.changeAddresses[0] !== 'mm6kLYbGEL1tGe4ZA8xacfgRPdW1NLjCbZ') {
                    return false;
                }
                if (info.changeAddresses[1] !== 'mjXZwmEi1z1MzveZrKUAo4DBgbdq4sBYT6') {
                    return false;
                }
                return true;
            });
        });
    });
});