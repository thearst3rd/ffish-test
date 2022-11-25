(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = exports.anim = void 0;
const util = require("./util");
function anim(mutation, state) {
    return state.animation.enabled ? animate(mutation, state) : render(mutation, state);
}
exports.anim = anim;
function render(mutation, state) {
    const result = mutation(state);
    state.dom.redraw();
    return result;
}
exports.render = render;
function makePiece(key, piece) {
    return {
        key: key,
        pos: util.key2pos(key),
        piece: piece
    };
}
function closer(piece, pieces) {
    return pieces.sort((p1, p2) => {
        return util.distanceSq(piece.pos, p1.pos) - util.distanceSq(piece.pos, p2.pos);
    })[0];
}
function computePlan(prevPieces, current) {
    const anims = {}, animedOrigs = [], fadings = {}, missings = [], news = [], prePieces = {};
    let curP, preP, i, vector;
    for (i in prevPieces) {
        prePieces[i] = makePiece(i, prevPieces[i]);
    }
    for (const key of util.allKeys(current.geometry)) {
        curP = current.pieces[key];
        preP = prePieces[key];
        if (curP) {
            if (preP) {
                if (!util.samePiece(curP, preP.piece)) {
                    missings.push(preP);
                    news.push(makePiece(key, curP));
                }
            }
            else
                news.push(makePiece(key, curP));
        }
        else if (preP)
            missings.push(preP);
    }
    news.forEach(newP => {
        preP = closer(newP, missings.filter(p => util.samePiece(newP.piece, p.piece)));
        if (preP) {
            vector = [preP.pos[0] - newP.pos[0], preP.pos[1] - newP.pos[1]];
            anims[newP.key] = vector.concat(vector);
            animedOrigs.push(preP.key);
        }
    });
    missings.forEach(p => {
        if (!util.containsX(animedOrigs, p.key))
            fadings[p.key] = p.piece;
    });
    return {
        anims: anims,
        fadings: fadings
    };
}
function step(state, now) {
    const cur = state.animation.current;
    if (cur === undefined) {
        if (!state.dom.destroyed)
            state.dom.redrawNow();
        return;
    }
    const rest = 1 - (now - cur.start) * cur.frequency;
    if (rest <= 0) {
        state.animation.current = undefined;
        state.dom.redrawNow();
    }
    else {
        const ease = easing(rest);
        for (let i in cur.plan.anims) {
            const cfg = cur.plan.anims[i];
            cfg[2] = cfg[0] * ease;
            cfg[3] = cfg[1] * ease;
        }
        state.dom.redrawNow(true);
        requestAnimationFrame((now = performance.now()) => step(state, now));
    }
}
function animate(mutation, state) {
    const prevPieces = Object.assign({}, state.pieces);
    const result = mutation(state);
    const plan = computePlan(prevPieces, state);
    if (!isObjectEmpty(plan.anims) || !isObjectEmpty(plan.fadings)) {
        const alreadyRunning = state.animation.current && state.animation.current.start;
        state.animation.current = {
            start: performance.now(),
            frequency: 1 / state.animation.duration,
            plan: plan
        };
        if (!alreadyRunning)
            step(state, performance.now());
    }
    else {
        state.dom.redraw();
    }
    return result;
}
function isObjectEmpty(o) {
    for (let _ in o)
        return false;
    return true;
}
function easing(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

},{"./util":18}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = void 0;
const board = require("./board");
const fen_1 = require("./fen");
const config_1 = require("./config");
const anim_1 = require("./anim");
const drag_1 = require("./drag");
const explosion_1 = require("./explosion");
function start(state, redrawAll) {
    function toggleOrientation() {
        board.toggleOrientation(state);
        redrawAll();
    }
    ;
    return {
        set(config) {
            if (config.orientation && config.orientation !== state.orientation)
                toggleOrientation();
            (config.fen ? anim_1.anim : anim_1.render)(state => config_1.configure(state, config), state);
        },
        state,
        getFen: () => fen_1.write(state.pieces, state.geometry),
        toggleOrientation,
        setPieces(pieces) {
            anim_1.anim(state => board.setPieces(state, pieces), state);
        },
        selectSquare(key, force) {
            if (key)
                anim_1.anim(state => board.selectSquare(state, key, force), state);
            else if (state.selected) {
                board.unselect(state);
                state.dom.redraw();
            }
        },
        move(orig, dest) {
            anim_1.anim(state => board.baseMove(state, orig, dest), state);
        },
        newPiece(piece, key) {
            anim_1.anim(state => board.baseNewPiece(state, piece, key), state);
        },
        playPremove() {
            if (state.premovable.current) {
                if (anim_1.anim(board.playPremove, state))
                    return true;
                state.dom.redraw();
            }
            return false;
        },
        playPredrop(validate) {
            if (state.predroppable.current) {
                const result = board.playPredrop(state, validate);
                state.dom.redraw();
                return result;
            }
            return false;
        },
        cancelPremove() {
            anim_1.render(board.unsetPremove, state);
        },
        cancelPredrop() {
            anim_1.render(board.unsetPredrop, state);
        },
        cancelMove() {
            anim_1.render(state => { board.cancelMove(state); drag_1.cancel(state); }, state);
        },
        stop() {
            anim_1.render(state => { board.stop(state); drag_1.cancel(state); }, state);
        },
        explode(keys) {
            explosion_1.default(state, keys);
        },
        setAutoShapes(shapes) {
            anim_1.render(state => state.drawable.autoShapes = shapes, state);
        },
        setShapes(shapes) {
            anim_1.render(state => state.drawable.shapes = shapes, state);
        },
        getKeyAtDomPos(pos) {
            return board.getKeyAtDomPos(pos, board.whitePov(state), state.dom.bounds(), state.geometry);
        },
        redrawAll,
        dragNewPiece(piece, event, force) {
            drag_1.dragNewPiece(state, piece, event, force);
        },
        destroy() {
            board.stop(state);
            state.dom.unbind && state.dom.unbind();
            state.dom.destroyed = true;
        }
    };
}
exports.start = start;

},{"./anim":1,"./board":3,"./config":5,"./drag":6,"./explosion":10,"./fen":11}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whitePov = exports.getKeyAtDomPos = exports.stop = exports.cancelMove = exports.playPredrop = exports.playPremove = exports.isDraggable = exports.isPredroppable = exports.canMove = exports.unselect = exports.setSelected = exports.selectSquare = exports.dropNewPiece = exports.userMove = exports.baseNewPiece = exports.baseMove = exports.unsetPredrop = exports.unsetPremove = exports.setCheck = exports.setPieces = exports.reset = exports.toggleOrientation = exports.callUserFunction = void 0;
const util_1 = require("./util");
const premove_1 = require("./premove");
const predrop_1 = require("./predrop");
const cg = require("./types");
const drop_1 = require("./drop");
function callUserFunction(f, ...args) {
    if (f)
        setTimeout(() => f(...args), 1);
}
exports.callUserFunction = callUserFunction;
function toggleOrientation(state) {
    state.orientation = util_1.opposite(state.orientation);
    state.animation.current =
        state.draggable.current =
            state.selected = undefined;
}
exports.toggleOrientation = toggleOrientation;
function reset(state) {
    state.lastMove = undefined;
    unselect(state);
    unsetPremove(state);
    unsetPredrop(state);
}
exports.reset = reset;
function setPieces(state, pieces) {
    for (let key in pieces) {
        const piece = pieces[key];
        if (piece)
            state.pieces[key] = piece;
        else
            delete state.pieces[key];
    }
}
exports.setPieces = setPieces;
function setCheck(state, color) {
    state.check = undefined;
    if (color === true)
        color = state.turnColor;
    if (color)
        for (let k in state.pieces) {
            if (state.pieces[k].role === 'k-piece' && state.pieces[k].color === color) {
                state.check = k;
            }
        }
}
exports.setCheck = setCheck;
function setPremove(state, orig, dest, meta) {
    unsetPredrop(state);
    state.premovable.current = [orig, dest];
    callUserFunction(state.premovable.events.set, orig, dest, meta);
}
function unsetPremove(state) {
    if (state.premovable.current) {
        state.premovable.current = undefined;
        callUserFunction(state.premovable.events.unset);
    }
}
exports.unsetPremove = unsetPremove;
function setPredrop(state, role, key) {
    unsetPremove(state);
    state.predroppable.current = { role, key };
    callUserFunction(state.predroppable.events.set, role, key);
}
function unsetPredrop(state) {
    const pd = state.predroppable;
    if (pd.current) {
        pd.current = undefined;
        callUserFunction(pd.events.unset);
    }
}
exports.unsetPredrop = unsetPredrop;
function tryAutoCastle(state, orig, dest) {
    if (!state.autoCastle)
        return false;
    const king = state.pieces[orig];
    if (!king || king.role !== 'k-piece')
        return false;
    const origPos = util_1.key2pos(orig);
    if (origPos[0] !== 5)
        return false;
    if (origPos[1] !== 1 && origPos[1] !== 8)
        return false;
    const destPos = util_1.key2pos(dest);
    let oldRookPos, newRookPos, newKingPos;
    if (destPos[0] === 7 || destPos[0] === 8) {
        oldRookPos = util_1.pos2key([8, origPos[1]]);
        newRookPos = util_1.pos2key([6, origPos[1]]);
        newKingPos = util_1.pos2key([7, origPos[1]]);
    }
    else if (destPos[0] === 3 || destPos[0] === 1) {
        oldRookPos = util_1.pos2key([1, origPos[1]]);
        newRookPos = util_1.pos2key([4, origPos[1]]);
        newKingPos = util_1.pos2key([3, origPos[1]]);
    }
    else
        return false;
    const rook = state.pieces[oldRookPos];
    if (!rook || rook.role !== 'r-piece')
        return false;
    delete state.pieces[orig];
    delete state.pieces[oldRookPos];
    state.pieces[newKingPos] = king;
    state.pieces[newRookPos] = rook;
    return true;
}
function baseMove(state, orig, dest) {
    const origPiece = state.pieces[orig], destPiece = state.pieces[dest];
    if (orig === dest || !origPiece)
        return false;
    const captured = (destPiece && destPiece.color !== origPiece.color) ? destPiece : undefined;
    if (dest == state.selected)
        unselect(state);
    callUserFunction(state.events.move, orig, dest, captured);
    if (!tryAutoCastle(state, orig, dest)) {
        state.pieces[dest] = origPiece;
        delete state.pieces[orig];
    }
    state.lastMove = [orig, dest];
    state.check = undefined;
    callUserFunction(state.events.change);
    return captured || true;
}
exports.baseMove = baseMove;
function baseNewPiece(state, piece, key, force) {
    if (state.pieces[key]) {
        if (force)
            delete state.pieces[key];
        else
            return false;
    }
    callUserFunction(state.events.dropNewPiece, piece, key);
    state.pieces[key] = piece;
    state.lastMove = [key];
    state.check = undefined;
    callUserFunction(state.events.change);
    state.movable.dests = undefined;
    state.dropmode.dropDests = undefined;
    state.turnColor = util_1.opposite(state.turnColor);
    return true;
}
exports.baseNewPiece = baseNewPiece;
function baseUserMove(state, orig, dest) {
    const result = baseMove(state, orig, dest);
    if (result) {
        state.movable.dests = undefined;
        state.dropmode.dropDests = undefined;
        state.turnColor = util_1.opposite(state.turnColor);
        state.animation.current = undefined;
    }
    return result;
}
function userMove(state, orig, dest) {
    if (canMove(state, orig, dest)) {
        const result = baseUserMove(state, orig, dest);
        if (result) {
            const holdTime = state.hold.stop();
            unselect(state);
            const metadata = {
                premove: false,
                ctrlKey: state.stats.ctrlKey,
                holdTime
            };
            if (result !== true)
                metadata.captured = result;
            callUserFunction(state.movable.events.after, orig, dest, metadata);
            return true;
        }
    }
    else if (canPremove(state, orig, dest)) {
        setPremove(state, orig, dest, {
            ctrlKey: state.stats.ctrlKey
        });
        unselect(state);
        return true;
    }
    unselect(state);
    return false;
}
exports.userMove = userMove;
function dropNewPiece(state, orig, dest, force) {
    if (canDrop(state, orig, dest) || force) {
        const piece = state.pieces[orig];
        delete state.pieces[orig];
        baseNewPiece(state, piece, dest, force);
        callUserFunction(state.movable.events.afterNewPiece, piece.role, dest, {
            predrop: false
        });
    }
    else if (canPredrop(state, orig, dest)) {
        setPredrop(state, state.pieces[orig].role, dest);
    }
    else {
        unsetPremove(state);
        unsetPredrop(state);
        drop_1.cancelDropMode(state);
    }
    delete state.pieces[orig];
    unselect(state);
}
exports.dropNewPiece = dropNewPiece;
function selectSquare(state, key, force) {
    callUserFunction(state.events.select, key);
    if (state.selected) {
        if (state.selected === key && !state.draggable.enabled) {
            unselect(state);
            state.hold.cancel();
            return;
        }
        else if ((state.selectable.enabled || force) && state.selected !== key) {
            if (userMove(state, state.selected, key)) {
                state.stats.dragged = false;
                return;
            }
        }
    }
    if (isMovable(state, key) || isPremovable(state, key)) {
        setSelected(state, key);
        state.hold.start();
    }
}
exports.selectSquare = selectSquare;
function setSelected(state, key) {
    state.selected = key;
    if (isPremovable(state, key)) {
        state.premovable.dests = premove_1.default(state.pieces, key, state.premovable.castle, state.geometry, state.variant, state.chess960);
    }
    else {
        state.premovable.dests = undefined;
        state.predroppable.dropDests = undefined;
    }
}
exports.setSelected = setSelected;
function unselect(state) {
    state.selected = undefined;
    state.premovable.dests = undefined;
    state.predroppable.dropDests = undefined;
    state.hold.cancel();
}
exports.unselect = unselect;
function isMovable(state, orig) {
    const piece = state.pieces[orig];
    return !!piece && (state.movable.color === 'both' || (state.movable.color === piece.color &&
        state.turnColor === piece.color));
}
function canMove(state, orig, dest) {
    return orig !== dest && isMovable(state, orig) && (state.movable.free || (!!state.movable.dests && util_1.containsX(state.movable.dests[orig], dest)));
}
exports.canMove = canMove;
function canDrop(state, orig, dest) {
    const piece = state.pieces[orig];
    return !!piece && dest && (orig === dest || !state.pieces[dest]) && (state.movable.color === 'both' || (state.movable.color === piece.color &&
        state.turnColor === piece.color));
}
function isPremovable(state, orig) {
    const piece = state.pieces[orig];
    return !!piece && state.premovable.enabled &&
        state.movable.color === piece.color &&
        state.turnColor !== piece.color;
}
function isPredroppable(state) {
    var _a, _b;
    const piece = state.dropmode.active ? state.dropmode.piece : (_a = state.draggable.current) === null || _a === void 0 ? void 0 : _a.piece;
    return (!!piece &&
        (state.dropmode.active || ((_b = state.draggable.current) === null || _b === void 0 ? void 0 : _b.orig) === 'a0') &&
        state.predroppable.enabled &&
        state.movable.color === piece.color &&
        state.turnColor !== piece.color);
}
exports.isPredroppable = isPredroppable;
function canPremove(state, orig, dest) {
    return orig !== dest &&
        isPremovable(state, orig) &&
        util_1.containsX(premove_1.default(state.pieces, orig, state.premovable.castle, state.geometry, state.variant, state.chess960), dest);
}
function canPredrop(state, orig, dest) {
    const piece = state.pieces[orig];
    if (!piece) {
        return false;
    }
    const isValidPredrop = util_1.containsX(predrop_1.default(state.pieces, piece, state.geometry, state.variant), dest);
    return dest &&
        state.predroppable.enabled &&
        isValidPredrop &&
        state.movable.color === piece.color &&
        state.turnColor !== piece.color;
}
function isDraggable(state, orig) {
    const piece = state.pieces[orig];
    return !!piece && state.draggable.enabled && (state.movable.color === 'both' || (state.movable.color === piece.color && (state.turnColor === piece.color || state.premovable.enabled)));
}
exports.isDraggable = isDraggable;
function playPremove(state) {
    const move = state.premovable.current;
    if (!move)
        return false;
    const orig = move[0], dest = move[1];
    let success = false;
    if (canMove(state, orig, dest)) {
        const result = baseUserMove(state, orig, dest);
        if (result) {
            const metadata = { premove: true };
            if (result !== true)
                metadata.captured = result;
            callUserFunction(state.movable.events.after, orig, dest, metadata);
            success = true;
        }
    }
    unsetPremove(state);
    return success;
}
exports.playPremove = playPremove;
function playPredrop(state, validate) {
    let drop = state.predroppable.current, success = false;
    if (!drop)
        return false;
    if (validate(drop)) {
        const piece = {
            role: drop.role,
            color: state.movable.color
        };
        if (baseNewPiece(state, piece, drop.key)) {
            callUserFunction(state.movable.events.afterNewPiece, drop.role, drop.key, {
                predrop: true
            });
            success = true;
        }
    }
    unsetPredrop(state);
    return success;
}
exports.playPredrop = playPredrop;
function cancelMove(state) {
    unsetPremove(state);
    unsetPredrop(state);
    unselect(state);
}
exports.cancelMove = cancelMove;
function stop(state) {
    state.movable.color =
        state.movable.dests =
            state.dropmode.dropDests =
                state.animation.current = undefined;
    cancelMove(state);
}
exports.stop = stop;
function getKeyAtDomPos(pos, asWhite, bounds, geom) {
    const bd = cg.dimensions[geom];
    let file = Math.ceil(bd.width * ((pos[0] - bounds.left) / bounds.width));
    if (!asWhite)
        file = bd.width + 1 - file;
    let rank = Math.ceil(bd.height - (bd.height * ((pos[1] - bounds.top) / bounds.height)));
    if (!asWhite)
        rank = bd.height + 1 - rank;
    return (file > 0 && file < bd.width + 1 && rank > 0 && rank < bd.height + 1) ? util_1.pos2key([file, rank]) : undefined;
}
exports.getKeyAtDomPos = getKeyAtDomPos;
function whitePov(s) {
    return s.orientation === 'white';
}
exports.whitePov = whitePov;

},{"./drop":8,"./predrop":12,"./premove":13,"./types":17,"./util":18}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chessground = void 0;
const api_1 = require("./api");
const config_1 = require("./config");
const state_1 = require("./state");
const wrap_1 = require("./wrap");
const events = require("./events");
const render_1 = require("./render");
const svg = require("./svg");
const util = require("./util");
function Chessground(element, config) {
    const state = state_1.defaults();
    config_1.configure(state, config || {});
    function redrawAll() {
        let prevUnbind = state.dom && state.dom.unbind;
        const relative = state.viewOnly && !state.drawable.visible, elements = wrap_1.default(element, state, relative), bounds = util.memo(() => elements.board.getBoundingClientRect()), redrawNow = (skipSvg) => {
            render_1.default(state);
            if (!skipSvg && elements.svg)
                svg.renderSvg(state, elements.svg);
        };
        state.dom = {
            elements,
            bounds,
            redraw: debounceRedraw(redrawNow),
            redrawNow,
            unbind: prevUnbind,
            relative
        };
        state.drawable.prevSvgHash = '';
        redrawNow(false);
        events.bindBoard(state);
        if (!prevUnbind)
            state.dom.unbind = events.bindDocument(state, redrawAll);
        state.events.insert && state.events.insert(elements);
    }
    redrawAll();
    return api_1.start(state, redrawAll);
}
exports.Chessground = Chessground;
;
function debounceRedraw(redrawNow) {
    let redrawing = false;
    return () => {
        if (redrawing)
            return;
        redrawing = true;
        requestAnimationFrame(() => {
            redrawNow();
            redrawing = false;
        });
    };
}

},{"./api":2,"./config":5,"./events":9,"./render":14,"./state":15,"./svg":16,"./util":18,"./wrap":19}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configure = void 0;
const board_1 = require("./board");
const fen_1 = require("./fen");
const cg = require("./types");
function configure(state, config) {
    var _a;
    if (config.movable && config.movable.dests)
        state.movable.dests = undefined;
    if ((_a = config.dropmode) === null || _a === void 0 ? void 0 : _a.dropDests)
        state.dropmode.dropDests = undefined;
    merge(state, config);
    if (config.geometry)
        state.dimensions = cg.dimensions[config.geometry];
    if (config.fen) {
        const pieces = fen_1.read(config.fen);
        if (state.pieces['a0'] !== undefined)
            pieces['a0'] = state.pieces['a0'];
        state.pieces = pieces;
        state.drawable.shapes = [];
    }
    if (config.hasOwnProperty('check'))
        board_1.setCheck(state, config.check || false);
    if (config.hasOwnProperty('lastMove') && !config.lastMove)
        state.lastMove = undefined;
    else if (config.lastMove)
        state.lastMove = config.lastMove;
    if (state.selected)
        board_1.setSelected(state, state.selected);
    if (!state.animation.duration || state.animation.duration < 100)
        state.animation.enabled = false;
    if (!state.movable.rookCastle && state.movable.dests) {
        const rank = state.movable.color === 'white' ? 1 : 8, kingStartPos = 'e' + rank, dests = state.movable.dests[kingStartPos], king = state.pieces[kingStartPos];
        if (!dests || !king || king.role !== 'k-piece')
            return;
        state.movable.dests[kingStartPos] = dests.filter(d => !((d === 'a' + rank) && dests.indexOf('c' + rank) !== -1) &&
            !((d === 'h' + rank) && dests.indexOf('g' + rank) !== -1));
    }
}
exports.configure = configure;
;
function merge(base, extend) {
    for (let key in extend) {
        if (isObject(base[key]) && isObject(extend[key]))
            merge(base[key], extend[key]);
        else
            base[key] = extend[key];
    }
}
function isObject(o) {
    return typeof o === 'object';
}

},{"./board":3,"./fen":11,"./types":17}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancel = exports.end = exports.move = exports.dragNewPiece = exports.pieceCloseTo = exports.start = void 0;
const board = require("./board");
const util = require("./util");
const draw_1 = require("./draw");
const anim_1 = require("./anim");
const predrop_1 = require("./predrop");
function start(s, e) {
    if (e.button !== undefined && e.button !== 0)
        return;
    if (e.touches && e.touches.length > 1)
        return;
    const bounds = s.dom.bounds(), position = util.eventPosition(e), orig = board.getKeyAtDomPos(position, board.whitePov(s), bounds, s.geometry);
    if (!orig)
        return;
    const piece = s.pieces[orig];
    const previouslySelected = s.selected;
    if (!previouslySelected && s.drawable.enabled && (s.drawable.eraseOnClick || (!piece || piece.color !== s.turnColor)))
        draw_1.clear(s);
    if (e.cancelable !== false &&
        (!e.touches || !s.movable.color || piece || previouslySelected || pieceCloseTo(s, position)))
        e.preventDefault();
    const hadPremove = !!s.premovable.current;
    const hadPredrop = !!s.predroppable.current;
    s.stats.ctrlKey = e.ctrlKey;
    if (s.selected && board.canMove(s, s.selected, orig)) {
        anim_1.anim(state => board.selectSquare(state, orig), s);
    }
    else {
        board.selectSquare(s, orig);
    }
    const stillSelected = s.selected === orig;
    const element = pieceElementByKey(s, orig);
    if (piece && element && stillSelected && board.isDraggable(s, orig)) {
        const squareBounds = computeSquareBounds(orig, board.whitePov(s), bounds, s.dimensions);
        s.draggable.current = {
            orig,
            origPos: util.key2pos(orig),
            piece,
            rel: position,
            epos: position,
            pos: [0, 0],
            dec: s.draggable.centerPiece ? [
                position[0] - (squareBounds.left + squareBounds.width / 2),
                position[1] - (squareBounds.top + squareBounds.height / 2)
            ] : [0, 0],
            started: s.draggable.autoDistance && s.stats.dragged,
            element,
            previouslySelected,
            originTarget: e.target
        };
        element.cgDragging = true;
        element.classList.add('dragging');
        const ghost = s.dom.elements.ghost;
        if (ghost) {
            const promoted = piece.promoted ? "promoted " : "";
            const side = piece.color === s.orientation ? "ally" : "enemy";
            ghost.className = `ghost ${piece.color} ${promoted}${piece.role} ${side}`;
            util.translateAbs(ghost, util.posToTranslateAbs(bounds, s.dimensions)(util.key2pos(orig), board.whitePov(s)));
            util.setVisible(ghost, true);
        }
        processDrag(s);
    }
    else {
        if (hadPremove)
            board.unsetPremove(s);
        if (hadPredrop)
            board.unsetPredrop(s);
    }
    s.dom.redraw();
}
exports.start = start;
function pieceCloseTo(s, pos) {
    const asWhite = board.whitePov(s), bounds = s.dom.bounds(), radiusSq = Math.pow(bounds.width / 8, 2);
    for (let key in s.pieces) {
        const squareBounds = computeSquareBounds(key, asWhite, bounds, s.dimensions), center = [
            squareBounds.left + squareBounds.width / 2,
            squareBounds.top + squareBounds.height / 2
        ];
        if (util.distanceSq(center, pos) <= radiusSq)
            return true;
    }
    return false;
}
exports.pieceCloseTo = pieceCloseTo;
function dragNewPiece(s, piece, e, force) {
    const key = 'a0';
    s.pieces[key] = piece;
    s.dom.redraw();
    const position = util.eventPosition(e), asWhite = board.whitePov(s), bounds = s.dom.bounds(), squareBounds = computeSquareBounds(key, asWhite, bounds, s.dimensions);
    const rel = [
        (asWhite ? 0 : s.dimensions.width - 1) * squareBounds.width + bounds.left,
        (asWhite ? s.dimensions.height : -1) * squareBounds.height + bounds.top
    ];
    s.draggable.current = {
        orig: key,
        origPos: util.key2pos('a0'),
        piece,
        rel,
        epos: position,
        pos: [position[0] - rel[0], position[1] - rel[1]],
        dec: [-squareBounds.width / 2, -squareBounds.height / 2],
        started: true,
        element: () => pieceElementByKey(s, key),
        originTarget: e.target,
        newPiece: true,
        force: !!force
    };
    if (piece && board.isPredroppable(s)) {
        s.predroppable.dropDests = predrop_1.default(s.pieces, piece, s.geometry, s.variant);
    }
    processDrag(s);
}
exports.dragNewPiece = dragNewPiece;
function processDrag(s) {
    requestAnimationFrame(() => {
        const cur = s.draggable.current;
        if (!cur)
            return;
        if (s.animation.current && s.animation.current.plan.anims[cur.orig])
            s.animation.current = undefined;
        const origPiece = s.pieces[cur.orig];
        if (!origPiece || !util.samePiece(origPiece, cur.piece))
            cancel(s);
        else {
            if (!cur.started && util.distanceSq(cur.epos, cur.rel) >= Math.pow(s.draggable.distance, 2))
                cur.started = true;
            if (cur.started) {
                if (typeof cur.element === 'function') {
                    const found = cur.element();
                    if (!found)
                        return;
                    found.cgDragging = true;
                    found.classList.add('dragging');
                    cur.element = found;
                }
                cur.pos = [
                    cur.epos[0] - cur.rel[0],
                    cur.epos[1] - cur.rel[1]
                ];
                const translation = util.posToTranslateAbs(s.dom.bounds(), s.dimensions)(cur.origPos, board.whitePov(s));
                translation[0] += cur.pos[0] + cur.dec[0];
                translation[1] += cur.pos[1] + cur.dec[1];
                util.translateAbs(cur.element, translation);
            }
        }
        processDrag(s);
    });
}
function move(s, e) {
    if (s.draggable.current && (!e.touches || e.touches.length < 2)) {
        s.draggable.current.epos = util.eventPosition(e);
    }
}
exports.move = move;
function end(s, e) {
    const cur = s.draggable.current;
    if (!cur)
        return;
    if (e.type === 'touchend' && e.cancelable !== false)
        e.preventDefault();
    if (e.type === 'touchend' && cur && cur.originTarget !== e.target && !cur.newPiece) {
        s.draggable.current = undefined;
        return;
    }
    board.unsetPremove(s);
    board.unsetPredrop(s);
    const eventPos = util.eventPosition(e) || cur.epos;
    const dest = board.getKeyAtDomPos(eventPos, board.whitePov(s), s.dom.bounds(), s.geometry);
    if (dest && cur.started && cur.orig !== dest) {
        if (cur.newPiece)
            board.dropNewPiece(s, cur.orig, dest, cur.force);
        else {
            s.stats.ctrlKey = e.ctrlKey;
            if (board.userMove(s, cur.orig, dest))
                s.stats.dragged = true;
        }
    }
    else if (cur.newPiece) {
        delete s.pieces[cur.orig];
    }
    else if (s.draggable.deleteOnDropOff && !dest) {
        delete s.pieces[cur.orig];
        board.callUserFunction(s.events.change);
    }
    if (cur && cur.orig === cur.previouslySelected && (cur.orig === dest || !dest))
        board.unselect(s);
    else if (!s.selectable.enabled)
        board.unselect(s);
    removeDragElements(s);
    s.draggable.current = undefined;
    s.dom.redraw();
}
exports.end = end;
function cancel(s) {
    const cur = s.draggable.current;
    if (cur) {
        if (cur.newPiece)
            delete s.pieces[cur.orig];
        s.draggable.current = undefined;
        board.unselect(s);
        removeDragElements(s);
        s.dom.redraw();
    }
}
exports.cancel = cancel;
function removeDragElements(s) {
    const e = s.dom.elements;
    if (e.ghost)
        util.setVisible(e.ghost, false);
}
function computeSquareBounds(key, asWhite, bounds, bd) {
    const pos = util.key2pos(key);
    if (!asWhite) {
        pos[0] = bd.width + 1 - pos[0];
        pos[1] = bd.height + 1 - pos[1];
    }
    return {
        left: bounds.left + bounds.width * (pos[0] - 1) / bd.width,
        top: bounds.top + bounds.height * (bd.height - pos[1]) / bd.height,
        width: bounds.width / bd.width,
        height: bounds.height / bd.height
    };
}
function pieceElementByKey(s, key) {
    let el = s.dom.elements.board.firstChild;
    while (el) {
        if (el.cgKey === key && el.tagName === 'PIECE')
            return el;
        el = el.nextSibling;
    }
    return undefined;
}

},{"./anim":1,"./board":3,"./draw":7,"./predrop":12,"./util":18}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clear = exports.cancel = exports.end = exports.move = exports.processDraw = exports.start = void 0;
const board_1 = require("./board");
const util_1 = require("./util");
const brushes = ['green', 'red', 'blue', 'yellow'];
function start(state, e) {
    if (e.touches && e.touches.length > 1)
        return;
    e.stopPropagation();
    e.preventDefault();
    e.ctrlKey ? board_1.unselect(state) : board_1.cancelMove(state);
    const pos = util_1.eventPosition(e), orig = board_1.getKeyAtDomPos(pos, board_1.whitePov(state), state.dom.bounds(), state.geometry);
    if (!orig)
        return;
    state.drawable.current = {
        orig,
        pos,
        brush: eventBrush(e)
    };
    processDraw(state);
}
exports.start = start;
function processDraw(state) {
    requestAnimationFrame(() => {
        const cur = state.drawable.current;
        if (cur) {
            const mouseSq = board_1.getKeyAtDomPos(cur.pos, board_1.whitePov(state), state.dom.bounds(), state.geometry);
            if (mouseSq !== cur.mouseSq) {
                cur.mouseSq = mouseSq;
                cur.dest = mouseSq !== cur.orig ? mouseSq : undefined;
                state.dom.redrawNow();
            }
            processDraw(state);
        }
    });
}
exports.processDraw = processDraw;
function move(state, e) {
    if (state.drawable.current)
        state.drawable.current.pos = util_1.eventPosition(e);
}
exports.move = move;
function end(state) {
    const cur = state.drawable.current;
    if (cur) {
        if (cur.mouseSq)
            addShape(state.drawable, cur);
        cancel(state);
    }
}
exports.end = end;
function cancel(state) {
    if (state.drawable.current) {
        state.drawable.current = undefined;
        state.dom.redraw();
    }
}
exports.cancel = cancel;
function clear(state) {
    if (state.drawable.shapes.length) {
        state.drawable.shapes = [];
        state.dom.redraw();
        onChange(state.drawable);
    }
}
exports.clear = clear;
function eventBrush(e) {
    return brushes[((e.shiftKey || e.ctrlKey) && util_1.isRightButton(e) ? 1 : 0) + (e.altKey ? 2 : 0)];
}
function addShape(drawable, cur) {
    const sameShape = (s) => s.orig === cur.orig && s.dest === cur.dest;
    const similar = drawable.shapes.filter(sameShape)[0];
    if (similar)
        drawable.shapes = drawable.shapes.filter(s => !sameShape(s));
    if (!similar || similar.brush !== cur.brush)
        drawable.shapes.push(cur);
    onChange(drawable);
}
function onChange(drawable) {
    if (drawable.onChange)
        drawable.onChange(drawable.shapes);
}

},{"./board":3,"./util":18}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drop = exports.cancelDropMode = exports.setDropMode = void 0;
const board = require("./board");
const util = require("./util");
const drag_1 = require("./drag");
const predrop_1 = require("./predrop");
const board_1 = require("./board");
function setDropMode(s, piece) {
    s.dropmode.active = true;
    s.dropmode.piece = piece;
    drag_1.cancel(s);
    board.unselect(s);
    if (piece && board.isPredroppable(s)) {
        s.predroppable.dropDests = predrop_1.default(s.pieces, piece, s.geometry, s.variant);
    }
}
exports.setDropMode = setDropMode;
function cancelDropMode(s) {
    var _a;
    s.dropmode.active = false;
    board_1.callUserFunction((_a = s.dropmode.events) === null || _a === void 0 ? void 0 : _a.cancel);
}
exports.cancelDropMode = cancelDropMode;
function drop(s, e) {
    if (!s.dropmode.active)
        return;
    board.unsetPremove(s);
    board.unsetPredrop(s);
    const piece = s.dropmode.piece;
    if (piece) {
        s.pieces.a0 = piece;
        const position = util.eventPosition(e);
        const dest = position && board.getKeyAtDomPos(position, board.whitePov(s), s.dom.bounds(), s.geometry);
        if (dest)
            board.dropNewPiece(s, 'a0', dest);
    }
    s.dom.redraw();
}
exports.drop = drop;

},{"./board":3,"./drag":6,"./predrop":12,"./util":18}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindDocument = exports.bindBoard = void 0;
const drag = require("./drag");
const draw = require("./draw");
const drop_1 = require("./drop");
const util_1 = require("./util");
const board_1 = require("./board");
function bindBoard(s) {
    if (s.viewOnly)
        return;
    const boardEl = s.dom.elements.board, onStart = startDragOrDraw(s);
    boardEl.addEventListener('touchstart', onStart, { passive: false });
    boardEl.addEventListener('mousedown', onStart, { passive: false });
    if (s.disableContextMenu || s.drawable.enabled) {
        boardEl.addEventListener('contextmenu', e => e.preventDefault());
    }
}
exports.bindBoard = bindBoard;
function bindDocument(s, redrawAll) {
    const unbinds = [];
    if (!s.dom.relative && s.resizable) {
        const onResize = () => {
            s.dom.bounds.clear();
            requestAnimationFrame(redrawAll);
        };
        unbinds.push(unbindable(document.body, 'chessground.resize', onResize));
    }
    if (!s.viewOnly) {
        const onmove = dragOrDraw(s, drag.move, draw.move);
        const onend = dragOrDraw(s, drag.end, draw.end);
        ['touchmove', 'mousemove'].forEach(ev => unbinds.push(unbindable(document, ev, onmove)));
        ['touchend', 'mouseup'].forEach(ev => unbinds.push(unbindable(document, ev, onend)));
        const onScroll = () => s.dom.bounds.clear();
        unbinds.push(unbindable(window, 'scroll', onScroll, { passive: true }));
        unbinds.push(unbindable(window, 'resize', onScroll, { passive: true }));
    }
    return () => unbinds.forEach(f => f());
}
exports.bindDocument = bindDocument;
function unbindable(el, eventName, callback, options) {
    el.addEventListener(eventName, callback, options);
    return () => el.removeEventListener(eventName, callback);
}
function startDragOrDraw(s) {
    return e => {
        var _a;
        if (s.draggable.current)
            drag.cancel(s);
        else if (s.drawable.current)
            draw.cancel(s);
        else if (e.shiftKey || util_1.isRightButton(e)) {
            if (s.drawable.enabled)
                draw.start(s, e);
        }
        else if (!s.viewOnly) {
            if (s.dropmode.active && undefined == squareOccupied(s, e)) {
                drop_1.drop(s, e);
            }
            else if (s.dropmode.active && s.movable.color != s.turnColor && ((_a = squareOccupied(s, e)) === null || _a === void 0 ? void 0 : _a.color) == s.turnColor) {
                drop_1.drop(s, e);
            }
            else {
                drop_1.cancelDropMode(s);
                drag.start(s, e);
            }
        }
    };
}
function dragOrDraw(s, withDrag, withDraw) {
    return e => {
        if (e.shiftKey || util_1.isRightButton(e)) {
            if (s.drawable.enabled)
                withDraw(s, e);
        }
        else if (!s.viewOnly)
            withDrag(s, e);
    };
}
function squareOccupied(s, e) {
    const position = util_1.eventPosition(e);
    const dest = position && board_1.getKeyAtDomPos(position, board_1.whitePov(s), s.dom.bounds(), s.geometry);
    if (dest && s.pieces[dest])
        return s.pieces[dest];
    return undefined;
}

},{"./board":3,"./drag":6,"./draw":7,"./drop":8,"./util":18}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function explosion(state, keys) {
    state.exploding = { stage: 1, keys };
    state.dom.redraw();
    setTimeout(() => {
        setStage(state, 2);
        setTimeout(() => setStage(state, undefined), 120);
    }, 120);
}
exports.default = explosion;
function setStage(state, stage) {
    if (state.exploding) {
        if (stage)
            state.exploding.stage = stage;
        else
            state.exploding = undefined;
        state.dom.redraw();
    }
}

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.write = exports.read = exports.initial = void 0;
const util_1 = require("./util");
const cg = require("./types");
exports.initial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
function roles(letter) {
    return (letter.replace("+", "p") + "-piece");
}
function letters(role) {
    const letterPart = role.slice(0, role.indexOf('-'));
    return (letterPart.length > 1) ? letterPart.replace('p', '+') : letterPart;
}
function read(fen) {
    if (fen === 'start')
        fen = exports.initial;
    if (fen.indexOf('[') !== -1)
        fen = fen.slice(0, fen.indexOf('['));
    const pieces = {};
    let row = fen.split("/").length;
    let col = 0;
    let promoted = false;
    let num = 0;
    for (const c of fen) {
        switch (c) {
            case ' ': return pieces;
            case '/':
                --row;
                if (row === 0)
                    return pieces;
                col = 0;
                num = 0;
                break;
            case '+':
                promoted = true;
                break;
            case '~':
                const piece = pieces[util_1.pos2key([col, row])];
                if (piece) {
                    piece.promoted = true;
                }
                break;
            default:
                const nb = c.charCodeAt(0);
                if (48 <= nb && nb < 58) {
                    num = 10 * num + nb - 48;
                }
                else {
                    col += 1 + num;
                    num = 0;
                    const letter = c.toLowerCase();
                    let piece = {
                        role: roles(letter),
                        color: (c === letter ? 'black' : 'white')
                    };
                    if (promoted) {
                        piece.role = ('p' + piece.role);
                        piece.promoted = true;
                        promoted = false;
                    }
                    ;
                    pieces[util_1.pos2key([col, row])] = piece;
                }
        }
    }
    return pieces;
}
exports.read = read;
function write(pieces, geom) {
    const bd = cg.dimensions[geom];
    return util_1.invNRanks.slice(-bd.height).map(y => util_1.NRanks.slice(0, bd.width).map(x => {
        const piece = pieces[util_1.pos2key([x, y])];
        if (piece) {
            const letter = letters(piece.role) + ((piece.promoted && (letters(piece.role).charAt(0) !== '+')) ? '~' : '');
            return (piece.color === 'white') ? letter.toUpperCase() : letter;
        }
        else
            return '1';
    }).join('')).join('/').replace(/1{2,}/g, s => s.length.toString());
}
exports.write = write;

},{"./types":17,"./util":18}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
const cg = require("./types");
const wholeBoard = (_x, _y) => true;
function rankRange(from, to, color, geom) {
    const height = cg.dimensions[geom].height;
    if (from < 1)
        from += height;
    if (to < 1)
        to += height;
    return (_x, y) => {
        if (color === 'black')
            y = height - y + 1;
        return from <= y && y <= to;
    };
}
function predrop(pieces, piece, geom, variant) {
    const color = piece.color;
    const role = piece.role;
    let mobility = wholeBoard;
    switch (variant) {
        case 'crazyhouse':
        case 'shouse':
        case 'capahouse':
        case 'gothhouse':
            switch (role) {
                case 'p-piece':
                    mobility = rankRange(2, -1, color, geom);
                    break;
            }
            break;
        case 'placement':
            mobility = rankRange(1, 1, color, geom);
            break;
        case 'sittuyin':
            switch (role) {
                case 'r-piece':
                    mobility = rankRange(1, 1, color, geom);
                    break;
                default: mobility = (x, y) => {
                    const width = cg.dimensions[geom].width;
                    const height = cg.dimensions[geom].height;
                    if (color === 'black') {
                        x = width - x + 1;
                        y = height - y + 1;
                    }
                    return y < 3 || (y === 3 && x > 4);
                };
            }
            break;
        case 'shogi':
        case 'minishogi':
        case 'gorogoro':
            switch (role) {
                case 'p-piece':
                case 'l-piece':
                    mobility = rankRange(1, -1, color, geom);
                    break;
                case 'n-piece':
                    mobility = rankRange(1, -2, color, geom);
                    break;
            }
            break;
        case 'kyotoshogi':
        case 'dobutsu':
            mobility = wholeBoard;
            break;
        case 'torishogi':
            switch (role) {
                case 's-piece':
                    mobility = rankRange(1, -1, color, geom);
                    break;
            }
            break;
        case 'grandhouse':
            switch (role) {
                case 'p-piece':
                    mobility = rankRange(2, 7, color, geom);
                    break;
            }
            break;
        case 'shogun':
            mobility = rankRange(1, 5, color, geom);
            break;
        case 'synochess':
            mobility = (_x, y) => y === 5;
            break;
        case 'shinobi':
            mobility = (_x, y) => y <= 4;
            break;
        default:
            console.warn("Unknown drop variant", variant);
    }
    return util.allKeys(geom).map(util.key2pos).filter(pos => {
        var _a;
        return ((_a = pieces[util.pos2key(pos)]) === null || _a === void 0 ? void 0 : _a.color) !== color && mobility(pos[0], pos[1]);
    }).map(util.pos2key);
}
exports.default = predrop;

},{"./types":17,"./util":18}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
const cg = require("./types");
function diff(a, b) {
    return Math.abs(a - b);
}
function pawn(color) {
    return (x1, y1, x2, y2) => diff(x1, x2) < 2 && (color === 'white' ? (y2 === y1 + 1 || (y1 <= 2 && y2 === (y1 + 2) && x1 === x2)) : (y2 === y1 - 1 || (y1 >= 7 && y2 === (y1 - 2) && x1 === x2)));
}
const knight = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return (xd === 1 && yd === 2) || (xd === 2 && yd === 1);
};
const bishop = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2);
};
const rook = (x1, y1, x2, y2) => {
    return x1 === x2 || y1 === y2;
};
const queen = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || rook(x1, y1, x2, y2);
};
function king(color, rookFiles, canCastle) {
    return (x1, y1, x2, y2) => (diff(x1, x2) < 2 && diff(y1, y2) < 2) || (canCastle && y1 === y2 && y1 === (color === 'white' ? 1 : 8) && ((x1 === 5 && ((util.containsX(rookFiles, 1) && x2 === 3) || (util.containsX(rookFiles, 8) && x2 === 7))) ||
        util.containsX(rookFiles, x2)));
}
function rookFilesOf(pieces, color) {
    const backrank = color === 'white' ? '1' : '8';
    return Object.keys(pieces).filter(key => {
        const piece = pieces[key];
        return key[1] === backrank && piece && piece.color === color && piece.role === 'r-piece';
    }).map((key) => util.key2pos(key)[0]);
}
const kingNoCastling = (x1, y1, x2, y2) => {
    return diff(x1, x2) < 2 && diff(y1, y2) < 2;
};
function king960(color, rookFiles, canCastle) {
    return (x1, y1, x2, y2) => (kingNoCastling(x1, y1, x2, y2)) || (canCastle && y1 === y2 && y1 === (color === 'white' ? 1 : 8) && util.containsX(rookFiles, x2));
}
function kingCapa(color, rookFiles, canCastle) {
    return (x1, y1, x2, y2) => (kingNoCastling(x1, y1, x2, y2)) || (canCastle && y1 === y2 && y1 === (color === 'white' ? 1 : 8) && (x1 == 6 && ((x2 == 9 && util.containsX(rookFiles, 10)) || (x2 == 3 && util.containsX(rookFiles, 1)))));
}
function kingShako(color, rookFiles, canCastle) {
    return (x1, y1, x2, y2) => (kingNoCastling(x1, y1, x2, y2)) || (canCastle && y1 === y2 && y1 === (color === 'white' ? 2 : 9) && (x1 == 6 && ((x2 == 8 && util.containsX(rookFiles, 9)) || (x2 == 4 && util.containsX(rookFiles, 2)))));
}
function rookFilesOfShako(pieces, color) {
    const backrank = color === 'white' ? '2' : '9';
    return Object.keys(pieces).filter(key => {
        const piece = pieces[key];
        return key[1] === backrank && piece && piece.color === color && piece.role === 'r-piece';
    }).map((key) => util.key2pos(key)[0]);
}
const wazir = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return (xd === 1 && yd === 0) || (xd === 0 && yd === 1);
};
const ferz = (x1, y1, x2, y2) => diff(x1, x2) === diff(y1, y2) && diff(x1, x2) === 1;
const elephant = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return xd === yd && xd === 2;
};
const archbishop = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
const chancellor = (x1, y1, x2, y2) => {
    return rook(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
const amazon = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || rook(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
const centaur = (x1, y1, x2, y2) => {
    return kingNoCastling(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
function grandPawn(color) {
    return (x1, y1, x2, y2) => diff(x1, x2) < 2 && (color === 'white' ? (y2 === y1 + 1 || (y1 <= 3 && y2 === (y1 + 2) && x1 === x2)) : (y2 === y1 - 1 || (y1 >= 8 && y2 === (y1 - 2) && x1 === x2)));
}
function shogiLance(color) {
    return (x1, y1, x2, y2) => (x2 === x1 && (color === 'white' ? y2 > y1 : y2 < y1));
}
function shogiSilver(color) {
    return (x1, y1, x2, y2) => (ferz(x1, y1, x2, y2) || (x1 === x2 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1)));
}
function shogiGold(color) {
    return (x1, y1, x2, y2) => (wazir(x1, y1, x2, y2) || (diff(x1, x2) < 2 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1)));
}
function shogiPawn(color) {
    return (x1, y1, x2, y2) => (x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1));
}
function shogiKnight(color) {
    return (x1, y1, x2, y2) => (x2 === x1 - 1 || x2 === x1 + 1) &&
        (color === 'white' ? (y2 === y1 + 2) : (y2 === y1 - 2));
}
const shogiDragon = (x1, y1, x2, y2) => {
    return rook(x1, y1, x2, y2) || ferz(x1, y1, x2, y2);
};
const shogiHorse = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || wazir(x1, y1, x2, y2);
};
function palace(geom, color) {
    const bd = cg.dimensions[geom];
    const middleFile = Math.floor((bd.width + 1) / 2);
    const startingRank = (color === "white") ? 1 : bd.height - 2;
    return [
        [middleFile - 1, startingRank + 2], [middleFile, startingRank + 2], [middleFile + 1, startingRank + 2],
        [middleFile - 1, startingRank + 1], [middleFile, startingRank + 1], [middleFile + 1, startingRank + 1],
        [middleFile - 1, startingRank], [middleFile, startingRank], [middleFile + 1, startingRank],
    ];
}
const palaces = {
    [3]: {
        white: palace(3, "white"),
        black: palace(3, "black"),
    },
    [6]: {
        white: palace(6, "white"),
        black: palace(6, "black"),
    },
};
function xiangqiPawn(color) {
    return (x1, y1, x2, y2) => ((x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1)) ||
        (y2 === y1 && diff(x1, x2) < 2 && (color === 'white' ? y1 > 5 : y1 < 6)));
}
function minixiangqiPawn(color) {
    return (x1, y1, x2, y2) => ((x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1)) ||
        (y2 === y1 && diff(x1, x2) < 2));
}
function xiangqiElephant(color) {
    return (x1, y1, x2, y2) => elephant(x1, y1, x2, y2) && (color === 'white' ? y2 < 6 : y2 > 5);
}
function xiangqiAdvisor(color, geom) {
    const palace = palaces[geom][color];
    return (x1, y1, x2, y2) => ferz(x1, y1, x2, y2) && palace.some(point => (point[0] === x2 && point[1] === y2));
}
function xiangqiKing(color, geom) {
    const palace = palaces[geom][color];
    return (x1, y1, x2, y2) => wazir(x1, y1, x2, y2) && palace.some(point => (point[0] === x2 && point[1] === y2));
}
const shakoElephant = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2) && (diff(x1, x2) < 3);
};
const janggiElephant = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return (xd === 2 && yd === 3) || (xd === 3 && yd === 2);
};
function janggiPawn(color, geom) {
    const oppPalace = palaces[geom][util.opposite(color)];
    return (x1, y1, x2, y2) => {
        const palacePos = oppPalace.findIndex(point => point[0] === x1 && point[1] === y1);
        let additionalMobility;
        switch (palacePos) {
            case 0:
                additionalMobility = (x1, y1, x2, y2) => x2 === x1 + 1 && color === 'black' && y2 === y1 - 1;
                break;
            case 2:
                additionalMobility = (x1, y1, x2, y2) => x2 === x1 - 1 && color === 'black' && y2 === y1 - 1;
                break;
            case 4:
                additionalMobility = (x1, y1, x2, y2) => diff(x1, x2) === 1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1);
                break;
            case 6:
                additionalMobility = (x1, y1, x2, y2) => x2 === x1 + 1 && color === 'white' && y2 === y1 + 1;
                break;
            case 8:
                additionalMobility = (x1, y1, x2, y2) => x2 === x1 - 1 && color === 'white' && y2 === y1 + 1;
                break;
            default: additionalMobility = () => false;
        }
        return (x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1)) ||
            (y2 === y1 && diff(x1, x2) < 2) ||
            additionalMobility(x1, y1, x2, y2);
    };
}
function janggiRook(geom) {
    const wPalace = palaces[geom]['white'];
    const bPalace = palaces[geom]['black'];
    return (x1, y1, x2, y2) => {
        let additionalMobility;
        const wPalacePos = wPalace.findIndex(point => point[0] === x1 && point[1] === y1);
        const bPalacePos = bPalace.findIndex(point => point[0] === x1 && point[1] === y1);
        const palacePos = wPalacePos !== -1 ? wPalacePos : bPalacePos;
        const xd = diff(x1, x2);
        const yd = diff(y1, y2);
        switch (palacePos) {
            case 0:
                additionalMobility = (x1, y1, x2, y2) => xd === yd && x2 > x1 && x2 <= x1 + 2 && y2 < y1 && y2 >= y1 - 2;
                break;
            case 2:
                additionalMobility = (x1, y1, x2, y2) => xd === yd && x2 < x1 && x2 >= x1 - 2 && y2 < y1 && y2 >= y1 - 2;
                break;
            case 4:
                additionalMobility = ferz;
                break;
            case 6:
                additionalMobility = (x1, y1, x2, y2) => xd === yd && x2 > x1 && x2 <= x1 + 2 && y2 > y1 && y2 <= y1 + 2;
                break;
            case 8:
                additionalMobility = (x1, y1, x2, y2) => xd === yd && x2 < x1 && x2 >= x1 - 2 && y2 > y1 && y2 <= y1 + 2;
                break;
            default: additionalMobility = () => false;
        }
        return rook(x1, y1, x2, y2) || additionalMobility(x1, y1, x2, y2);
    };
}
function janggiKing(color, geom) {
    const palace = palaces[geom][color];
    return (x1, y1, x2, y2) => {
        const palacePos = palace.findIndex(point => point[0] === x1 && point[1] === y1);
        let additionalMobility;
        switch (palacePos) {
            case 0:
                additionalMobility = (x1, y1, x2, y2) => x2 === x1 + 1 && y2 === y1 - 1;
                break;
            case 2:
                additionalMobility = (x1, y1, x2, y2) => x2 === x1 - 1 && y2 === y1 - 1;
                break;
            case 4:
                additionalMobility = ferz;
                break;
            case 6:
                additionalMobility = (x1, y1, x2, y2) => x2 === x1 + 1 && y2 === y1 + 1;
                break;
            case 8:
                additionalMobility = (x1, y1, x2, y2) => x2 === x1 - 1 && y2 === y1 + 1;
                break;
            default: additionalMobility = () => false;
        }
        return (wazir(x1, y1, x2, y2) || additionalMobility(x1, y1, x2, y2)) && palace.some(point => (point[0] === x2 && point[1] === y2));
    };
}
const musketeerLeopard = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return ((xd === 1 || xd === 2)
        && (yd === 1 || yd === 2));
};
const musketeerHawk = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return ((xd === 0 && (yd === 2 || yd === 3))
        || (yd === 0 && (xd === 2 || xd === 3))
        || (xd === yd && (xd === 2 || xd === 3)));
};
const musketeerElephant = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return (xd === 1 || yd === 1
        || (xd === 2 && (yd === 0 || yd === 2))
        || (xd === 0 && yd === 2));
};
const musketeerCannon = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return ((xd < 3)
        && ((yd < 2) || (yd === 2 && xd === 0)));
};
const musketeerUnicorn = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return knight(x1, y1, x2, y2) || (xd === 1 && yd === 3) || (xd === 3 && yd === 1);
};
const musketeerDragon = (x1, y1, x2, y2) => {
    return knight(x1, y1, x2, y2) || queen(x1, y1, x2, y2);
};
const musketeerFortress = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return ((xd === yd && xd < 4)
        || (yd === 0 && xd === 2)
        || (yd === 2 && xd < 2));
};
const musketeerSpider = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return (xd < 3 && yd < 3
        && !(xd === 1 && yd === 0)
        && !(xd === 0 && yd === 1));
};
function toriGoose(color) {
    return (x1, y1, x2, y2) => {
        const xd = diff(x1, x2);
        return (color === 'white') ?
            (xd === 2 && y2 === y1 + 2) || (xd === 0 && y2 === y1 - 2)
            :
                (xd === 2 && y2 === y1 - 2) || (xd === 0 && y2 === y1 + 2);
    };
}
function toriLeftQuail(color) {
    return (x1, y1, x2, y2) => {
        const xd = diff(x1, x2);
        const yd = diff(y1, y2);
        return (color === 'white') ?
            (x2 === x1 && y2 > y1) || (xd === yd && x2 > x1 && y2 < y1) || (x2 === x1 - 1 && y2 === y1 - 1)
            :
                (x2 === x1 && y2 < y1) || (xd === yd && x2 < x1 && y2 > y1) || (x2 === x1 + 1 && y2 === y1 + 1);
    };
}
function toriRightQuail(color) {
    return (x1, y1, x2, y2) => {
        const xd = diff(x1, x2);
        const yd = diff(y1, y2);
        return (color === 'white') ?
            (x2 === x1 && y2 > y1) || (xd === yd && x2 < x1 && y2 < y1) || (x2 === x1 + 1 && y2 === y1 - 1)
            :
                (x2 === x1 && y2 < y1) || (xd === yd && x2 > x1 && y2 > y1) || (x2 === x1 - 1 && y2 === y1 + 1);
    };
}
function toriPheasant(color) {
    return (x1, y1, x2, y2) => {
        const xd = diff(x1, x2);
        return (color === 'white') ?
            (x2 === x1 && y2 === y1 + 2) || (xd === 1 && y2 === y1 - 1)
            :
                (x2 === x1 && y2 === y1 - 2) || (xd === 1 && y2 === y1 + 1);
    };
}
const toriCrane = (x1, y1, x2, y2) => {
    return kingNoCastling(x1, y1, x2, y2) && y2 !== y1;
};
function toriFalcon(color) {
    return (x1, y1, x2, y2) => {
        return (color === 'white') ?
            kingNoCastling(x1, y1, x2, y2) && !(x2 === x1 && y2 === y1 - 1)
            :
                kingNoCastling(x1, y1, x2, y2) && !(x2 === x1 && y2 === y1 + 1);
    };
}
function toriEagle(color) {
    return (x1, y1, x2, y2) => {
        const xd = diff(x1, x2);
        const yd = diff(y1, y2);
        return (color === 'white') ?
            kingNoCastling(x1, y1, x2, y2) || (xd === yd && (y2 > y1 || (y2 < y1 && yd <= 2))) || (x2 === x1 && y2 < y1)
            :
                kingNoCastling(x1, y1, x2, y2) || (xd === yd && (y2 < y1 || (y2 > y1 && yd <= 2))) || (x2 === x1 && y2 > y1);
    };
}
function premove(pieces, key, canCastle, geom, variant, chess960) {
    const piece = pieces[key];
    const role = piece.role;
    const color = piece.color;
    const pos = util.key2pos(key);
    let mobility;
    switch (variant) {
        case 'xiangqi':
        case 'manchu':
            switch (role) {
                case 'p-piece':
                    mobility = xiangqiPawn(color);
                    break;
                case 'c-piece':
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = xiangqiElephant(color);
                    break;
                case 'a-piece':
                    mobility = xiangqiAdvisor(color, geom);
                    break;
                case 'k-piece':
                    mobility = xiangqiKing(color, geom);
                    break;
                case 'm-piece':
                    mobility = chancellor;
                    break;
            }
            break;
        case 'janggi':
            switch (piece.role) {
                case 'p-piece':
                    mobility = janggiPawn(color, geom);
                    break;
                case 'c-piece':
                case 'r-piece':
                    mobility = janggiRook(geom);
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = janggiElephant;
                    break;
                case 'a-piece':
                case 'k-piece':
                    mobility = janggiKing(color, geom);
                    break;
            }
            break;
        case 'minixiangqi':
            {
                switch (piece.role) {
                    case 'p-piece':
                        mobility = minixiangqiPawn(color);
                        break;
                    case 'c-piece':
                    case 'r-piece':
                        mobility = rook;
                        break;
                    case 'n-piece':
                        mobility = knight;
                        break;
                    case 'k-piece':
                        mobility = xiangqiKing(color, geom);
                        break;
                }
            }
            break;
        case 'shogi':
        case 'minishogi':
        case 'gorogoro':
            switch (piece.role) {
                case 'p-piece':
                    mobility = shogiPawn(color);
                    break;
                case 'l-piece':
                    mobility = shogiLance(color);
                    break;
                case 'n-piece':
                    mobility = shogiKnight(color);
                    break;
                case 'k-piece':
                    mobility = kingNoCastling;
                    break;
                case 's-piece':
                    mobility = shogiSilver(color);
                    break;
                case 'pp-piece':
                case 'pl-piece':
                case 'pn-piece':
                case 'ps-piece':
                case 'g-piece':
                    mobility = shogiGold(color);
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'pr-piece':
                    mobility = shogiDragon;
                    break;
                case 'pb-piece':
                    mobility = shogiHorse;
                    break;
            }
            ;
            break;
        case 'kyotoshogi':
            switch (piece.role) {
                case 'l-piece':
                    mobility = shogiLance(color);
                    break;
                case 'pl-piece':
                    mobility = shogiGold(color);
                    break;
                case 's-piece':
                    mobility = shogiSilver(color);
                    break;
                case 'ps-piece':
                    mobility = bishop;
                    break;
                case 'n-piece':
                    mobility = shogiKnight(color);
                    break;
                case 'pn-piece':
                    mobility = shogiGold(color);
                    break;
                case 'p-piece':
                    mobility = shogiPawn(color);
                    break;
                case 'pp-piece':
                    mobility = rook;
                    break;
                case 'k-piece':
                    mobility = kingNoCastling;
                    break;
            }
            ;
            break;
        case 'dobutsu':
            switch (piece.role) {
                case 'c-piece':
                    mobility = shogiPawn(color);
                    break;
                case 'e-piece':
                    mobility = ferz;
                    break;
                case 'g-piece':
                    mobility = wazir;
                    break;
                case 'l-piece':
                    mobility = kingNoCastling;
                    break;
                case 'pc-piece':
                    mobility = shogiGold(color);
                    break;
            }
            break;
        case 'torishogi':
            switch (role) {
                case 's-piece':
                    mobility = shogiPawn(color);
                    break;
                case 'ps-piece':
                    mobility = toriGoose(color);
                    break;
                case 'l-piece':
                    mobility = toriLeftQuail(color);
                    break;
                case 'r-piece':
                    mobility = toriRightQuail(color);
                    break;
                case 'p-piece':
                    mobility = toriPheasant(color);
                    break;
                case 'c-piece':
                    mobility = toriCrane;
                    break;
                case 'f-piece':
                    mobility = toriFalcon(color);
                    break;
                case 'pf-piece':
                    mobility = toriEagle(color);
                    break;
                case 'k-piece':
                    mobility = kingNoCastling;
                    break;
            }
            break;
        case 'makruk':
        case 'makpong':
        case 'sittuyin':
        case 'cambodian':
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 's-piece':
                    mobility = shogiSilver(color);
                    break;
                case 'f-piece':
                case 'm-piece':
                    mobility = ferz;
                    break;
                case 'k-piece':
                    mobility = kingNoCastling;
                    break;
            }
            break;
        case 'grand':
        case 'grandhouse':
            switch (role) {
                case 'p-piece':
                    mobility = grandPawn(color);
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'q-piece':
                    mobility = queen;
                    break;
                case 'c-piece':
                    mobility = chancellor;
                    break;
                case 'a-piece':
                    mobility = archbishop;
                    break;
                case 'k-piece':
                    mobility = kingNoCastling;
                    break;
            }
            break;
        case 'shako':
            switch (role) {
                case 'p-piece':
                    mobility = grandPawn(color);
                    break;
                case 'c-piece':
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'q-piece':
                    mobility = queen;
                    break;
                case 'e-piece':
                    mobility = shakoElephant;
                    break;
                case 'k-piece':
                    mobility = kingShako(color, rookFilesOfShako(pieces, color), canCastle);
                    break;
            }
            break;
        case 'shogun':
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 'pp-piece':
                    mobility = kingNoCastling;
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'pr-piece':
                    mobility = chancellor;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'pn-piece':
                    mobility = centaur;
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'pb-piece':
                    mobility = archbishop;
                    break;
                case 'f-piece':
                    mobility = ferz;
                    break;
                case 'pf-piece':
                    mobility = queen;
                    break;
                case 'k-piece':
                    mobility = king(color, rookFilesOf(pieces, color), canCastle);
                    break;
            }
            break;
        case 'orda':
        case 'ordamirror':
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'q-piece':
                    mobility = queen;
                    break;
                case 'l-piece':
                    mobility = chancellor;
                    break;
                case 'h-piece':
                    mobility = centaur;
                    break;
                case 'a-piece':
                    mobility = archbishop;
                    break;
                case 'y-piece':
                    mobility = shogiSilver(color);
                    break;
                case 'f-piece':
                    mobility = amazon;
                    break;
                case 'k-piece':
                    mobility = king(color, rookFilesOf(pieces, color), canCastle);
                    break;
            }
            break;
        case 'synochess':
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 'c-piece':
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'q-piece':
                    mobility = queen;
                    break;
                case 's-piece':
                    mobility = minixiangqiPawn(color);
                    break;
                case 'e-piece':
                    mobility = shakoElephant;
                    break;
                case 'a-piece':
                    mobility = kingNoCastling;
                    break;
                case 'k-piece':
                    mobility = king(color, rookFilesOf(pieces, color), canCastle && color === 'white');
                    break;
            }
            break;
        case 'musketeer':
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'q-piece':
                    mobility = queen;
                    break;
                case 'l-piece':
                    mobility = musketeerLeopard;
                    break;
                case 'o-piece':
                    mobility = musketeerCannon;
                    break;
                case 'u-piece':
                    mobility = musketeerUnicorn;
                    break;
                case 'd-piece':
                    mobility = musketeerDragon;
                    break;
                case 'c-piece':
                    mobility = chancellor;
                    break;
                case 'a-piece':
                    mobility = archbishop;
                    break;
                case 'e-piece':
                    mobility = musketeerElephant;
                    break;
                case 'h-piece': mobility = musketeerHawk;
                case 'f-piece': mobility = musketeerFortress;
                case 's-piece': mobility = musketeerSpider;
                case 'k-piece':
                    mobility = king(color, rookFilesOf(pieces, color), canCastle);
                    break;
            }
            break;
        case 'hoppelpoppel':
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                case 'b-piece':
                    mobility = archbishop;
                    break;
                case 'q-piece':
                    mobility = queen;
                    break;
                case 'k-piece':
                    mobility = king(color, rookFilesOf(pieces, color), canCastle);
                    break;
            }
            break;
        case 'shinobi':
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 'pl-piece':
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'ph-piece':
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'pm-piece':
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'q-piece':
                    mobility = queen;
                    break;
                case 'pp-piece':
                case 'c-piece':
                    mobility = kingNoCastling;
                    break;
                case 'l-piece':
                    mobility = shogiLance(color);
                    break;
                case 'h-piece':
                    mobility = shogiKnight(color);
                    break;
                case 'm-piece':
                    mobility = ferz;
                    break;
                case 'd-piece':
                    mobility = shogiDragon;
                    break;
                case 'j-piece':
                    mobility = archbishop;
                    break;
                case 'k-piece':
                    mobility = king(color, rookFilesOf(pieces, color), canCastle);
                    break;
            }
            break;
        case 'empire':
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 's-piece':
                    mobility = minixiangqiPawn(color);
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'd-piece':
                case 't-piece':
                case 'c-piece':
                case 'q-piece':
                    mobility = queen;
                    break;
                case 'e-piece':
                    mobility = amazon;
                    break;
                case 'k-piece':
                    mobility = king(color, rookFilesOf(pieces, color), canCastle);
                    break;
            }
            break;
        case 'capablanca':
        case 'capahouse':
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'q-piece':
                    mobility = queen;
                    break;
                case 'c-piece':
                    mobility = chancellor;
                    break;
                case 'a-piece':
                    mobility = archbishop;
                    break;
                case 'k-piece':
                    mobility = chess960 ? king960(color, rookFilesOf(pieces, color), canCastle) : kingCapa(color, rookFilesOf(pieces, color), canCastle);
                    break;
            }
            break;
        default:
            switch (role) {
                case 'p-piece':
                    mobility = pawn(color);
                    break;
                case 'r-piece':
                    mobility = rook;
                    break;
                case 'n-piece':
                    mobility = knight;
                    break;
                case 'b-piece':
                    mobility = bishop;
                    break;
                case 'q-piece':
                    mobility = queen;
                    break;
                case 'e-piece':
                case 'c-piece':
                    mobility = chancellor;
                    break;
                case 'h-piece':
                case 'a-piece':
                    mobility = archbishop;
                    break;
                case 'k-piece':
                    mobility = chess960 ? king960(color, rookFilesOf(pieces, color), canCastle) : king(color, rookFilesOf(pieces, color), canCastle);
                    break;
            }
    }
    return util.allKeys(geom).map(util.key2pos).filter(pos2 => {
        return (pos[0] !== pos2[0] || pos[1] !== pos2[1]) && mobility(pos[0], pos[1], pos2[0], pos2[1]);
    }).map(util.pos2key);
}
exports.default = premove;

},{"./types":17,"./util":18}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const board_1 = require("./board");
const util = require("./util");
function render(s) {
    const asWhite = board_1.whitePov(s), posToTranslate = s.dom.relative ? util.posToTranslateRel : util.posToTranslateAbs(s.dom.bounds(), s.dimensions), translate = s.dom.relative ? util.translateRel : util.translateAbs, boardEl = s.dom.elements.board, pieces = s.pieces, curAnim = s.animation.current, anims = curAnim ? curAnim.plan.anims : {}, fadings = curAnim ? curAnim.plan.fadings : {}, curDrag = s.draggable.current, squares = computeSquareClasses(s), samePieces = {}, sameSquares = {}, movedPieces = {}, movedSquares = {}, piecesKeys = Object.keys(pieces);
    let k, p, el, pieceAtKey, elPieceName, anim, fading, pMvdset, pMvd, sMvdset, sMvd;
    el = boardEl.firstChild;
    while (el) {
        k = el.cgKey;
        if (isPieceNode(el)) {
            pieceAtKey = pieces[k];
            anim = anims[k];
            fading = fadings[k];
            elPieceName = el.cgPiece;
            if (el.cgDragging && (!curDrag || curDrag.orig !== k)) {
                el.classList.remove('dragging');
                translate(el, posToTranslate(util_1.key2pos(k), asWhite, s.dimensions));
                el.cgDragging = false;
            }
            if (!fading && el.cgFading) {
                el.cgFading = false;
                el.classList.remove('fading');
            }
            if (pieceAtKey) {
                if (anim && el.cgAnimating && elPieceName === pieceNameOf(pieceAtKey, s.orientation)) {
                    const pos = util_1.key2pos(k);
                    pos[0] += anim[2];
                    pos[1] += anim[3];
                    el.classList.add('anim');
                    translate(el, posToTranslate(pos, asWhite, s.dimensions));
                }
                else if (el.cgAnimating) {
                    el.cgAnimating = false;
                    el.classList.remove('anim');
                    translate(el, posToTranslate(util_1.key2pos(k), asWhite, s.dimensions));
                    if (s.addPieceZIndex)
                        el.style.zIndex = posZIndex(util_1.key2pos(k), asWhite);
                }
                if (elPieceName === pieceNameOf(pieceAtKey, s.orientation) && (!fading || !el.cgFading)) {
                    samePieces[k] = true;
                }
                else {
                    if (fading && elPieceName === pieceNameOf(fading, s.orientation)) {
                        el.classList.add('fading');
                        el.cgFading = true;
                    }
                    else {
                        if (movedPieces[elPieceName])
                            movedPieces[elPieceName].push(el);
                        else
                            movedPieces[elPieceName] = [el];
                    }
                }
            }
            else {
                if (movedPieces[elPieceName])
                    movedPieces[elPieceName].push(el);
                else
                    movedPieces[elPieceName] = [el];
            }
        }
        else if (isSquareNode(el)) {
            const cn = el.className;
            if (squares[k] === cn)
                sameSquares[k] = true;
            else if (movedSquares[cn])
                movedSquares[cn].push(el);
            else
                movedSquares[cn] = [el];
        }
        el = el.nextSibling;
    }
    for (const sk in squares) {
        if (!sameSquares[sk]) {
            sMvdset = movedSquares[squares[sk]];
            sMvd = sMvdset && sMvdset.pop();
            const translation = posToTranslate(util_1.key2pos(sk), asWhite, s.dimensions);
            if (sMvd) {
                sMvd.cgKey = sk;
                translate(sMvd, translation);
            }
            else {
                const squareNode = util_1.createEl('square', squares[sk]);
                squareNode.cgKey = sk;
                translate(squareNode, translation);
                boardEl.insertBefore(squareNode, boardEl.firstChild);
            }
        }
    }
    for (const j in piecesKeys) {
        k = piecesKeys[j];
        p = pieces[k];
        anim = anims[k];
        if (!samePieces[k]) {
            pMvdset = movedPieces[pieceNameOf(p, s.orientation)];
            pMvd = pMvdset && pMvdset.pop();
            if (pMvd) {
                pMvd.cgKey = k;
                if (pMvd.cgFading) {
                    pMvd.classList.remove('fading');
                    pMvd.cgFading = false;
                }
                const pos = util_1.key2pos(k);
                if (s.addPieceZIndex)
                    pMvd.style.zIndex = posZIndex(pos, asWhite);
                if (anim) {
                    pMvd.cgAnimating = true;
                    pMvd.classList.add('anim');
                    pos[0] += anim[2];
                    pos[1] += anim[3];
                }
                translate(pMvd, posToTranslate(pos, asWhite, s.dimensions));
            }
            else {
                const pieceName = pieceNameOf(p, s.orientation), pieceNode = util_1.createEl('piece', pieceName), pos = util_1.key2pos(k);
                pieceNode.cgPiece = pieceName;
                pieceNode.cgKey = k;
                if (anim) {
                    pieceNode.cgAnimating = true;
                    pos[0] += anim[2];
                    pos[1] += anim[3];
                }
                translate(pieceNode, posToTranslate(pos, asWhite, s.dimensions));
                if (s.addPieceZIndex)
                    pieceNode.style.zIndex = posZIndex(pos, asWhite);
                boardEl.appendChild(pieceNode);
            }
        }
    }
    for (const i in movedPieces)
        removeNodes(s, movedPieces[i]);
    for (const i in movedSquares)
        removeNodes(s, movedSquares[i]);
}
exports.default = render;
function isPieceNode(el) {
    return el.tagName === 'PIECE';
}
function isSquareNode(el) {
    return el.tagName === 'SQUARE';
}
function removeNodes(s, nodes) {
    for (const i in nodes)
        s.dom.elements.board.removeChild(nodes[i]);
}
function posZIndex(pos, asWhite) {
    let z = 2 + (pos[1] - 1) * 8 + (8 - pos[0]);
    if (asWhite)
        z = 67 - z;
    return z + '';
}
function pieceNameOf(piece, orientation) {
    const promoted = piece.promoted ? "promoted " : "";
    const side = piece.color === orientation ? "ally" : "enemy";
    return `${piece.color} ${promoted}${piece.role} ${side}`;
}
function computeSquareClasses(s) {
    var _a, _b, _c;
    const squares = {};
    let i, k;
    if (s.lastMove && s.highlight.lastMove)
        for (i in s.lastMove) {
            if (s.lastMove[i] != 'a0') {
                addSquare(squares, s.lastMove[i], 'last-move');
            }
        }
    if (s.check && s.highlight.check)
        addSquare(squares, s.check, 'check');
    if (s.selected) {
        addSquare(squares, s.selected, 'selected');
        if (s.movable.showDests) {
            const dests = s.movable.dests && s.movable.dests[s.selected];
            if (dests)
                for (i in dests) {
                    k = dests[i];
                    addSquare(squares, k, 'move-dest' + (s.pieces[k] ? ' oc' : ''));
                }
            const pDests = s.premovable.dests;
            if (pDests)
                for (i in pDests) {
                    k = pDests[i];
                    addSquare(squares, k, 'premove-dest' + (s.pieces[k] ? ' oc' : ''));
                }
        }
    }
    else if (s.dropmode.active || ((_a = s.draggable.current) === null || _a === void 0 ? void 0 : _a.orig) === 'a0') {
        const piece = s.dropmode.active ? s.dropmode.piece : (_b = s.draggable.current) === null || _b === void 0 ? void 0 : _b.piece;
        if (piece) {
            if (s.dropmode.showDropDests) {
                const dests = (_c = s.dropmode.dropDests) === null || _c === void 0 ? void 0 : _c.get(piece.role);
                if (dests)
                    for (const k of dests) {
                        addSquare(squares, k, 'move-dest');
                    }
            }
            if (s.predroppable.showDropDests) {
                const pDests = s.predroppable.dropDests;
                if (pDests)
                    for (const k of pDests) {
                        addSquare(squares, k, 'premove-dest' + (s.pieces[k] ? ' oc' : ''));
                    }
            }
        }
    }
    const premove = s.premovable.current;
    if (premove)
        for (i in premove)
            addSquare(squares, premove[i], 'current-premove');
    else if (s.predroppable.current)
        addSquare(squares, s.predroppable.current.key, 'current-premove');
    const o = s.exploding;
    if (o)
        for (i in o.keys)
            addSquare(squares, o.keys[i], 'exploding' + o.stage);
    return squares;
}
function addSquare(squares, key, klass) {
    if (squares[key])
        squares[key] += ' ' + klass;
    else
        squares[key] = klass;
}

},{"./board":3,"./util":18}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaults = void 0;
const fen = require("./fen");
const util_1 = require("./util");
function defaults() {
    return {
        pieces: fen.read(fen.initial),
        orientation: 'white',
        turnColor: 'white',
        coordinates: true,
        autoCastle: true,
        viewOnly: false,
        disableContextMenu: false,
        resizable: true,
        addPieceZIndex: false,
        pieceKey: false,
        highlight: {
            lastMove: true,
            check: true
        },
        animation: {
            enabled: true,
            duration: 200
        },
        movable: {
            free: true,
            color: 'both',
            showDests: true,
            events: {},
            rookCastle: true
        },
        premovable: {
            enabled: true,
            showDests: true,
            castle: true,
            events: {}
        },
        predroppable: {
            enabled: false,
            showDropDests: true,
            events: {}
        },
        draggable: {
            enabled: true,
            distance: 3,
            autoDistance: true,
            centerPiece: true,
            showGhost: true,
            deleteOnDropOff: false
        },
        dropmode: {
            active: false,
            showDropDests: true,
        },
        selectable: {
            enabled: true
        },
        stats: {
            dragged: !('ontouchstart' in window)
        },
        events: {},
        drawable: {
            enabled: true,
            visible: true,
            eraseOnClick: true,
            shapes: [],
            autoShapes: [],
            brushes: {
                green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
                red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
                blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
                yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
                paleBlue: { key: 'pb', color: '#003088', opacity: 0.4, lineWidth: 15 },
                paleGreen: { key: 'pg', color: '#15781B', opacity: 0.4, lineWidth: 15 },
                paleRed: { key: 'pr', color: '#882020', opacity: 0.4, lineWidth: 15 },
                paleGrey: { key: 'pgr', color: '#4a4a4a', opacity: 0.35, lineWidth: 15 }
            },
            pieces: {
                baseUrl: 'https://lichess1.org/assets/piece/cburnett/'
            },
            prevSvgHash: ''
        },
        hold: util_1.timer(),
        dimensions: { width: 8, height: 8 },
        geometry: 0,
        variant: 'chess',
        chess960: false,
        notation: 0,
    };
}
exports.defaults = defaults;

},{"./fen":11,"./util":18}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSvg = exports.createElement = void 0;
const util_1 = require("./util");
function createElement(tagName) {
    return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}
exports.createElement = createElement;
function renderSvg(state, root) {
    const d = state.drawable, curD = d.current, cur = curD && curD.mouseSq ? curD : undefined, arrowDests = {};
    d.shapes.concat(d.autoShapes).concat(cur ? [cur] : []).forEach(s => {
        if (s.dest)
            arrowDests[s.dest] = (arrowDests[s.dest] || 0) + 1;
    });
    const shapes = d.shapes.concat(d.autoShapes).map((s) => {
        return {
            shape: s,
            current: false,
            hash: shapeHash(s, arrowDests, false)
        };
    });
    if (cur)
        shapes.push({
            shape: cur,
            current: true,
            hash: shapeHash(cur, arrowDests, true)
        });
    const fullHash = shapes.map(sc => sc.hash).join('');
    if (fullHash === state.drawable.prevSvgHash)
        return;
    state.drawable.prevSvgHash = fullHash;
    const defsEl = root.firstChild;
    syncDefs(d, shapes, defsEl);
    syncShapes(state, shapes, d.brushes, arrowDests, root, defsEl);
}
exports.renderSvg = renderSvg;
function syncDefs(d, shapes, defsEl) {
    const brushes = {};
    let brush;
    shapes.forEach(s => {
        if (s.shape.dest) {
            brush = d.brushes[s.shape.brush];
            if (s.shape.modifiers)
                brush = makeCustomBrush(brush, s.shape.modifiers);
            brushes[brush.key] = brush;
        }
    });
    const keysInDom = {};
    let el = defsEl.firstChild;
    while (el) {
        keysInDom[el.getAttribute('cgKey')] = true;
        el = el.nextSibling;
    }
    for (let key in brushes) {
        if (!keysInDom[key])
            defsEl.appendChild(renderMarker(brushes[key]));
    }
}
function syncShapes(state, shapes, brushes, arrowDests, root, defsEl) {
    const bounds = state.dom.bounds(), hashesInDom = {}, toRemove = [];
    shapes.forEach(sc => { hashesInDom[sc.hash] = false; });
    let el = defsEl.nextSibling, elHash;
    while (el) {
        elHash = el.getAttribute('cgHash');
        if (hashesInDom.hasOwnProperty(elHash))
            hashesInDom[elHash] = true;
        else
            toRemove.push(el);
        el = el.nextSibling;
    }
    toRemove.forEach(el => root.removeChild(el));
    shapes.forEach(sc => {
        if (!hashesInDom[sc.hash])
            root.appendChild(renderShape(state, sc, brushes, arrowDests, bounds));
    });
}
function shapeHash({ orig, dest, brush, piece, modifiers }, arrowDests, current) {
    return [current, orig, dest, brush, dest && arrowDests[dest] > 1,
        piece && pieceHash(piece),
        modifiers && modifiersHash(modifiers)
    ].filter(x => x).join('');
}
function pieceHash(piece) {
    return [piece.color, piece.role, piece.scale].filter(x => x).join('');
}
function modifiersHash(m) {
    return '' + (m.lineWidth || '');
}
function renderShape(state, { shape, current, hash }, brushes, arrowDests, bounds) {
    let el;
    if (shape.piece)
        el = renderPiece(state.drawable.pieces.baseUrl, orient(util_1.key2pos(shape.orig), state.orientation, state.dimensions), shape.piece, bounds, state.dimensions, state.orientation);
    else {
        const orig = orient(util_1.key2pos(shape.orig), state.orientation, state.dimensions);
        if (shape.orig && shape.dest) {
            let brush = brushes[shape.brush];
            if (shape.modifiers)
                brush = makeCustomBrush(brush, shape.modifiers);
            el = renderArrow(brush, orig, orient(util_1.key2pos(shape.dest), state.orientation, state.dimensions), current, arrowDests[shape.dest] > 1, bounds, state.dimensions);
        }
        else
            el = renderCircle(brushes[shape.brush], orig, current, bounds, state.dimensions);
    }
    el.setAttribute('cgHash', hash);
    return el;
}
function renderCircle(brush, pos, current, bounds, bd) {
    const o = pos2px(pos, bounds, bd), widths = circleWidth(bounds, bd), radius = (bounds.width / bd.width) / 2;
    return setAttributes(createElement('circle'), {
        stroke: brush.color,
        'stroke-width': widths[current ? 0 : 1],
        fill: 'none',
        opacity: opacity(brush, current),
        cx: o[0],
        cy: o[1],
        r: radius - widths[1] / 2
    });
}
function renderArrow(brush, orig, dest, current, shorten, bounds, bd) {
    const m = arrowMargin(bounds, shorten && !current, bd), a = pos2px(orig, bounds, bd), b = pos2px(dest, bounds, bd), dx = b[0] - a[0], dy = b[1] - a[1], angle = Math.atan2(dy, dx), xo = Math.cos(angle) * m, yo = Math.sin(angle) * m;
    return setAttributes(createElement('line'), {
        stroke: brush.color,
        'stroke-width': lineWidth(brush, current, bounds, bd),
        'stroke-linecap': 'round',
        'marker-end': 'url(#arrowhead-' + brush.key + ')',
        opacity: opacity(brush, current),
        x1: a[0],
        y1: a[1],
        x2: b[0] - xo,
        y2: b[1] - yo
    });
}
function renderPiece(baseUrl, pos, piece, bounds, bd, orientation) {
    const o = pos2px(pos, bounds, bd), width = bounds.width / bd.width * (piece.scale || 1), height = bounds.height / bd.height * (piece.scale || 1), name = piece.color[0] + piece.role[0].toUpperCase();
    const href = (baseUrl.endsWith('/') ? baseUrl + name + '.svg' : baseUrl);
    const side = piece.color === orientation ? "ally" : "enemy";
    return setAttributes(createElement('image'), {
        className: `${piece.role} ${piece.color} ${side}`,
        x: o[0] - width / 2,
        y: o[1] - height / 2,
        width: width,
        height: height,
        href: href
    });
}
function renderMarker(brush) {
    const marker = setAttributes(createElement('marker'), {
        id: 'arrowhead-' + brush.key,
        orient: 'auto',
        markerWidth: 4,
        markerHeight: 8,
        refX: 2.05,
        refY: 2.01
    });
    marker.appendChild(setAttributes(createElement('path'), {
        d: 'M0,0 V4 L3,2 Z',
        fill: brush.color
    }));
    marker.setAttribute('cgKey', brush.key);
    return marker;
}
function setAttributes(el, attrs) {
    for (let key in attrs)
        el.setAttribute(key, attrs[key]);
    return el;
}
function orient(pos, color, bd) {
    return color === 'white' ? pos : [bd.width + 1 - pos[0], bd.height + 1 - pos[1]];
}
function makeCustomBrush(base, modifiers) {
    const brush = {
        color: base.color,
        opacity: Math.round(base.opacity * 10) / 10,
        lineWidth: Math.round(modifiers.lineWidth || base.lineWidth)
    };
    brush.key = [base.key, modifiers.lineWidth].filter(x => x).join('');
    return brush;
}
function circleWidth(bounds, bd) {
    const base = bounds.width / (bd.width * 64);
    return [3 * base, 4 * base];
}
function lineWidth(brush, current, bounds, bd) {
    return (brush.lineWidth || 10) * (current ? 0.85 : 1) / (bd.width * 64) * bounds.width;
}
function opacity(brush, current) {
    return (brush.opacity || 1) * (current ? 0.9 : 1);
}
function arrowMargin(bounds, shorten, bd) {
    return (shorten ? 20 : 10) / (bd.width * 64) * bounds.width;
}
function pos2px(pos, bounds, bd) {
    return [(pos[0] - 0.5) * bounds.width / bd.width, (bd.height + 0.5 - pos[1]) * bounds.height / bd.height];
}

},{"./util":18}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shogiVariants = exports.dimensions = exports.letters = exports.ranks10 = exports.ranks = exports.files = void 0;
exports.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
exports.ranks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ':'];
exports.ranks10 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
exports.letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
;
;
exports.dimensions = [{ width: 8, height: 8 }, { width: 9, height: 9 }, { width: 10, height: 8 }, { width: 9, height: 10 }, { width: 10, height: 10 }, { width: 5, height: 5 }, { width: 7, height: 7 }, { width: 3, height: 4 }, { width: 5, height: 6 }];
exports.shogiVariants = ['shogi', 'minishogi', 'kyotoshogi', 'dobutsu', 'gorogoro', 'torishogi'];

},{}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEl = exports.isRightButton = exports.eventPosition = exports.setVisible = exports.translateRel = exports.translateAbs = exports.posToTranslateRel = exports.posToTranslateAbs = exports.samePiece = exports.distanceSq = exports.containsX = exports.opposite = exports.timer = exports.memo = exports.key2pos = exports.pos2key = exports.allKeys = exports.invNRanks = exports.NRanks = exports.colors = void 0;
const cg = require("./types");
exports.colors = ['white', 'black'];
exports.NRanks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
exports.invNRanks = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
function files(n) {
    return cg.files.slice(0, n);
}
function ranks(n) {
    return cg.ranks.slice(0, n);
}
function allKeys(geom) {
    const bd = cg.dimensions[geom];
    return Array.prototype.concat(...files(bd.width).map(c => ranks(bd.height).map(r => c + r)));
}
exports.allKeys = allKeys;
function pos2key(pos) {
    return (cg.files[pos[0] - 1] + cg.ranks[pos[1] - 1]);
}
exports.pos2key = pos2key;
function key2pos(k) {
    return [k.charCodeAt(0) - 96, k.charCodeAt(1) - 48];
}
exports.key2pos = key2pos;
function memo(f) {
    let v;
    const ret = () => {
        if (v === undefined)
            v = f();
        return v;
    };
    ret.clear = () => { v = undefined; };
    return ret;
}
exports.memo = memo;
const timer = () => {
    let startAt;
    return {
        start() { startAt = performance.now(); },
        cancel() { startAt = undefined; },
        stop() {
            if (!startAt)
                return 0;
            const time = performance.now() - startAt;
            startAt = undefined;
            return time;
        }
    };
};
exports.timer = timer;
const opposite = (c) => c === 'white' ? 'black' : 'white';
exports.opposite = opposite;
function containsX(xs, x) {
    return xs !== undefined && xs.indexOf(x) !== -1;
}
exports.containsX = containsX;
const distanceSq = (pos1, pos2) => {
    return Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[1] - pos2[1], 2);
};
exports.distanceSq = distanceSq;
const samePiece = (p1, p2) => p1.role === p2.role && p1.color === p2.color;
exports.samePiece = samePiece;
const posToTranslateBase = (pos, asWhite, xFactor, yFactor, bt) => [
    (asWhite ? pos[0] - 1 : bt.width - pos[0]) * xFactor,
    (asWhite ? bt.height - pos[1] : pos[1] - 1) * yFactor
];
const posToTranslateAbs = (bounds, bt) => {
    const xFactor = bounds.width / bt.width, yFactor = bounds.height / bt.height;
    return (pos, asWhite) => posToTranslateBase(pos, asWhite, xFactor, yFactor, bt);
};
exports.posToTranslateAbs = posToTranslateAbs;
const posToTranslateRel = (pos, asWhite, bt) => posToTranslateBase(pos, asWhite, 100 / bt.width, 100 / bt.height, bt);
exports.posToTranslateRel = posToTranslateRel;
const translateAbs = (el, pos) => {
    el.style.transform = `translate(${pos[0]}px,${pos[1]}px)`;
};
exports.translateAbs = translateAbs;
const translateRel = (el, percents) => {
    el.style.transform = `translate(${percents[0]}%,${percents[1]}%)`;
};
exports.translateRel = translateRel;
const setVisible = (el, v) => {
    el.style.visibility = v ? 'visible' : 'hidden';
};
exports.setVisible = setVisible;
const eventPosition = e => {
    if (e.clientX || e.clientX === 0)
        return [e.clientX, e.clientY];
    if (e.touches && e.targetTouches[0])
        return [e.targetTouches[0].clientX, e.targetTouches[0].clientY];
    return undefined;
};
exports.eventPosition = eventPosition;
const isRightButton = (e) => e.buttons === 2 || e.button === 2;
exports.isRightButton = isRightButton;
const createEl = (tagName, className) => {
    const el = document.createElement(tagName);
    if (className)
        el.className = className;
    return el;
};
exports.createEl = createEl;

},{"./types":17}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const types_1 = require("./types");
const svg_1 = require("./svg");
function wrap(element, s, relative) {
    element.innerHTML = '';
    element.classList.add('cg-wrap');
    util_1.colors.forEach(c => element.classList.toggle('orientation-' + c, s.orientation === c));
    element.classList.toggle('manipulable', !s.viewOnly);
    const helper = util_1.createEl('cg-helper');
    element.appendChild(helper);
    const container = util_1.createEl('cg-container');
    helper.appendChild(container);
    const extension = util_1.createEl('extension');
    container.appendChild(extension);
    const board = util_1.createEl('cg-board');
    container.appendChild(board);
    let svg;
    if (s.drawable.visible && !relative) {
        svg = svg_1.createElement('svg');
        svg.appendChild(svg_1.createElement('defs'));
        container.appendChild(svg);
    }
    if (s.coordinates) {
        const orientClass = s.orientation === 'black' ? ' black' : '';
        const shogi = (types_1.shogiVariants.includes(s.variant));
        if (shogi) {
            container.appendChild(renderCoords(types_1.ranks.slice(0, s.dimensions.height).reverse(), 'files' + orientClass));
            container.appendChild(renderCoords(types_1.ranks.slice(0, s.dimensions.width).reverse(), 'ranks' + orientClass));
        }
        else if (s.notation === 6) {
            container.appendChild(renderCoords((['0']).concat(types_1.ranks.slice(0, 9).reverse()), 'ranks' + orientClass));
            container.appendChild(renderCoords(types_1.ranks.slice(0, 9), 'files' + orientClass));
        }
        else {
            container.appendChild(renderCoords(types_1.ranks10.slice(0, s.dimensions.height), 'ranks' + orientClass));
            container.appendChild(renderCoords(types_1.files.slice(0, s.dimensions.width), 'files' + orientClass));
        }
    }
    let ghost;
    if (s.draggable.showGhost && !relative) {
        ghost = util_1.createEl('piece', 'ghost');
        util_1.setVisible(ghost, false);
        container.appendChild(ghost);
    }
    return {
        board,
        container,
        ghost,
        svg
    };
}
exports.default = wrap;
function renderCoords(elems, className) {
    const el = util_1.createEl('coords', className);
    let f;
    for (let i in elems) {
        f = util_1.createEl('coord');
        f.textContent = elems[i];
        el.appendChild(f);
    }
    return el;
}

},{"./svg":16,"./types":17,"./util":18}],20:[function(require,module,exports){
(function (process){(function (){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var Module = function () {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;

  return function (Module) {
    Module = Module || {};
    var Module = typeof Module !== "undefined" ? Module : {};
    var readyPromiseResolve, readyPromiseReject;
    Module["ready"] = new Promise(function (resolve, reject) {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
    var moduleOverrides = {};
    var key;

    for (key in Module) {
      if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key];
      }
    }

    var arguments_ = [];
    var thisProgram = "./this.program";

    var quit_ = function (status, toThrow) {
      throw toThrow;
    };

    var ENVIRONMENT_IS_WEB = typeof window === "object";
    var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
    var ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
    var scriptDirectory = "";

    function locateFile(path) {
      if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory);
      }

      return scriptDirectory + path;
    }

    var read_, readAsync, readBinary, setWindowTitle;

    if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href;
      } else if (typeof document !== "undefined" && document.currentScript) {
        scriptDirectory = document.currentScript.src;
      }

      if (_scriptDir) {
        scriptDirectory = _scriptDir;
      }

      if (scriptDirectory.indexOf("blob:") !== 0) {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
      } else {
        scriptDirectory = "";
      }

      {
        read_ = function (url) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.send(null);
          return xhr.responseText;
        };

        if (ENVIRONMENT_IS_WORKER) {
          readBinary = function (url) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(xhr.response);
          };
        }

        readAsync = function (url, onload, onerror) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";

          xhr.onload = function () {
            if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
              onload(xhr.response);
              return;
            }

            onerror();
          };

          xhr.onerror = onerror;
          xhr.send(null);
        };
      }

      setWindowTitle = function (title) {
        document.title = title;
      };
    } else {}

    var out = Module["print"] || console.log.bind(console);
    var err = Module["printErr"] || console.warn.bind(console);

    for (key in moduleOverrides) {
      if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key];
      }
    }

    moduleOverrides = null;
    if (Module["arguments"]) arguments_ = Module["arguments"];
    if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
    if (Module["quit"]) quit_ = Module["quit"];
    var tempRet0 = 0;

    var setTempRet0 = function (value) {
      tempRet0 = value;
    };

    var wasmBinary;
    if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
    var noExitRuntime = Module["noExitRuntime"] || true;

    if (typeof WebAssembly !== "object") {
      abort("no native wasm support detected");
    }

    var wasmMemory;
    var ABORT = false;
    var EXITSTATUS;

    function assert(condition, text) {
      if (!condition) {
        abort("Assertion failed: " + text);
      }
    }

    var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

    function UTF8ArrayToString(heap, idx, maxBytesToRead) {
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx;

      while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

      if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(heap.subarray(idx, endPtr));
      } else {
        var str = "";

        while (idx < endPtr) {
          var u0 = heap[idx++];

          if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue;
          }

          var u1 = heap[idx++] & 63;

          if ((u0 & 224) == 192) {
            str += String.fromCharCode((u0 & 31) << 6 | u1);
            continue;
          }

          var u2 = heap[idx++] & 63;

          if ((u0 & 240) == 224) {
            u0 = (u0 & 15) << 12 | u1 << 6 | u2;
          } else {
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++] & 63;
          }

          if (u0 < 65536) {
            str += String.fromCharCode(u0);
          } else {
            var ch = u0 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
          }
        }
      }

      return str;
    }

    function UTF8ToString(ptr, maxBytesToRead) {
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
    }

    function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
      if (!(maxBytesToWrite > 0)) return 0;
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1;

      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);

        if (u >= 55296 && u <= 57343) {
          var u1 = str.charCodeAt(++i);
          u = 65536 + ((u & 1023) << 10) | u1 & 1023;
        }

        if (u <= 127) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 2047) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 192 | u >> 6;
          heap[outIdx++] = 128 | u & 63;
        } else if (u <= 65535) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 224 | u >> 12;
          heap[outIdx++] = 128 | u >> 6 & 63;
          heap[outIdx++] = 128 | u & 63;
        } else {
          if (outIdx + 3 >= endIdx) break;
          heap[outIdx++] = 240 | u >> 18;
          heap[outIdx++] = 128 | u >> 12 & 63;
          heap[outIdx++] = 128 | u >> 6 & 63;
          heap[outIdx++] = 128 | u & 63;
        }
      }

      heap[outIdx] = 0;
      return outIdx - startIdx;
    }

    function stringToUTF8(str, outPtr, maxBytesToWrite) {
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    }

    function lengthBytesUTF8(str) {
      var len = 0;

      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
        if (u <= 127) ++len;else if (u <= 2047) len += 2;else if (u <= 65535) len += 3;else len += 4;
      }

      return len;
    }

    var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

    function UTF16ToString(ptr, maxBytesToRead) {
      var endPtr = ptr;
      var idx = endPtr >> 1;
      var maxIdx = idx + maxBytesToRead / 2;

      while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;

      endPtr = idx << 1;

      if (endPtr - ptr > 32 && UTF16Decoder) {
        return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
      } else {
        var str = "";

        for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
          var codeUnit = HEAP16[ptr + i * 2 >> 1];
          if (codeUnit == 0) break;
          str += String.fromCharCode(codeUnit);
        }

        return str;
      }
    }

    function stringToUTF16(str, outPtr, maxBytesToWrite) {
      if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 2147483647;
      }

      if (maxBytesToWrite < 2) return 0;
      maxBytesToWrite -= 2;
      var startPtr = outPtr;
      var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;

      for (var i = 0; i < numCharsToWrite; ++i) {
        var codeUnit = str.charCodeAt(i);
        HEAP16[outPtr >> 1] = codeUnit;
        outPtr += 2;
      }

      HEAP16[outPtr >> 1] = 0;
      return outPtr - startPtr;
    }

    function lengthBytesUTF16(str) {
      return str.length * 2;
    }

    function UTF32ToString(ptr, maxBytesToRead) {
      var i = 0;
      var str = "";

      while (!(i >= maxBytesToRead / 4)) {
        var utf32 = HEAP32[ptr + i * 4 >> 2];
        if (utf32 == 0) break;
        ++i;

        if (utf32 >= 65536) {
          var ch = utf32 - 65536;
          str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
        } else {
          str += String.fromCharCode(utf32);
        }
      }

      return str;
    }

    function stringToUTF32(str, outPtr, maxBytesToWrite) {
      if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 2147483647;
      }

      if (maxBytesToWrite < 4) return 0;
      var startPtr = outPtr;
      var endPtr = startPtr + maxBytesToWrite - 4;

      for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);

        if (codeUnit >= 55296 && codeUnit <= 57343) {
          var trailSurrogate = str.charCodeAt(++i);
          codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
        }

        HEAP32[outPtr >> 2] = codeUnit;
        outPtr += 4;
        if (outPtr + 4 > endPtr) break;
      }

      HEAP32[outPtr >> 2] = 0;
      return outPtr - startPtr;
    }

    function lengthBytesUTF32(str) {
      var len = 0;

      for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
        len += 4;
      }

      return len;
    }

    function writeArrayToMemory(array, buffer) {
      HEAP8.set(array, buffer);
    }

    function writeAsciiToMemory(str, buffer, dontAddNull) {
      for (var i = 0; i < str.length; ++i) {
        HEAP8[buffer++ >> 0] = str.charCodeAt(i);
      }

      if (!dontAddNull) HEAP8[buffer >> 0] = 0;
    }

    function alignUp(x, multiple) {
      if (x % multiple > 0) {
        x += multiple - x % multiple;
      }

      return x;
    }

    var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

    function updateGlobalBufferAndViews(buf) {
      buffer = buf;
      Module["HEAP8"] = HEAP8 = new Int8Array(buf);
      Module["HEAP16"] = HEAP16 = new Int16Array(buf);
      Module["HEAP32"] = HEAP32 = new Int32Array(buf);
      Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
      Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
      Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
      Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
      Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
    }

    var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 33554432;
    var wasmTable;
    var __ATPRERUN__ = [];
    var __ATINIT__ = [];
    var __ATPOSTRUN__ = [];
    var runtimeInitialized = false;
    var runtimeExited = false;
    var runtimeKeepaliveCounter = 0;

    function keepRuntimeAlive() {
      return noExitRuntime || runtimeKeepaliveCounter > 0;
    }

    function preRun() {
      if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];

        while (Module["preRun"].length) {
          addOnPreRun(Module["preRun"].shift());
        }
      }

      callRuntimeCallbacks(__ATPRERUN__);
    }

    function initRuntime() {
      runtimeInitialized = true;
      if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
      FS.ignorePermissions = false;
      TTY.init();
      callRuntimeCallbacks(__ATINIT__);
    }

    function exitRuntime() {
      runtimeExited = true;
    }

    function postRun() {
      if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];

        while (Module["postRun"].length) {
          addOnPostRun(Module["postRun"].shift());
        }
      }

      callRuntimeCallbacks(__ATPOSTRUN__);
    }

    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb);
    }

    function addOnInit(cb) {
      __ATINIT__.unshift(cb);
    }

    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb);
    }

    var runDependencies = 0;
    var runDependencyWatcher = null;
    var dependenciesFulfilled = null;

    function getUniqueRunDependency(id) {
      return id;
    }

    function addRunDependency(id) {
      runDependencies++;

      if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies);
      }
    }

    function removeRunDependency(id) {
      runDependencies--;

      if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies);
      }

      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }

        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback();
        }
      }
    }

    Module["preloadedImages"] = {};
    Module["preloadedAudios"] = {};

    function abort(what) {
      {
        if (Module["onAbort"]) {
          Module["onAbort"](what);
        }
      }
      what = "Aborted(" + what + ")";
      err(what);
      ABORT = true;
      EXITSTATUS = 1;
      what += ". Build with -s ASSERTIONS=1 for more info.";
      var e = new WebAssembly.RuntimeError(what);
      readyPromiseReject(e);
      throw e;
    }

    var dataURIPrefix = "data:application/octet-stream;base64,";

    function isDataURI(filename) {
      return filename.startsWith(dataURIPrefix);
    }

    var wasmBinaryFile;
    wasmBinaryFile = "ffish.wasm";

    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = locateFile(wasmBinaryFile);
    }

    function getBinary(file) {
      try {
        if (file == wasmBinaryFile && wasmBinary) {
          return new Uint8Array(wasmBinary);
        }

        if (readBinary) {
          return readBinary(file);
        } else {
          throw "both async and sync fetching of the wasm failed";
        }
      } catch (err) {
        abort(err);
      }
    }

    function getBinaryPromise() {
      if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
        if (typeof fetch === "function") {
          return fetch(wasmBinaryFile, {
            credentials: "same-origin"
          }).then(function (response) {
            if (!response["ok"]) {
              throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
            }

            return response["arrayBuffer"]();
          }).catch(function () {
            return getBinary(wasmBinaryFile);
          });
        }
      }

      return Promise.resolve().then(function () {
        return getBinary(wasmBinaryFile);
      });
    }

    function createWasm() {
      var info = {
        "a": asmLibraryArg
      };

      function receiveInstance(instance, module) {
        var exports = instance.exports;
        Module["asm"] = exports;
        wasmMemory = Module["asm"]["N"];
        updateGlobalBufferAndViews(wasmMemory.buffer);
        wasmTable = Module["asm"]["Q"];
        addOnInit(Module["asm"]["O"]);
        removeRunDependency("wasm-instantiate");
      }

      addRunDependency("wasm-instantiate");

      function receiveInstantiationResult(result) {
        receiveInstance(result["instance"]);
      }

      function instantiateArrayBuffer(receiver) {
        return getBinaryPromise().then(function (binary) {
          return WebAssembly.instantiate(binary, info);
        }).then(function (instance) {
          return instance;
        }).then(receiver, function (reason) {
          err("failed to asynchronously prepare wasm: " + reason);
          abort(reason);
        });
      }

      function instantiateAsync() {
        if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
          return fetch(wasmBinaryFile, {
            credentials: "same-origin"
          }).then(function (response) {
            var result = WebAssembly.instantiateStreaming(response, info);
            return result.then(receiveInstantiationResult, function (reason) {
              err("wasm streaming compile failed: " + reason);
              err("falling back to ArrayBuffer instantiation");
              return instantiateArrayBuffer(receiveInstantiationResult);
            });
          });
        } else {
          return instantiateArrayBuffer(receiveInstantiationResult);
        }
      }

      if (Module["instantiateWasm"]) {
        try {
          var exports = Module["instantiateWasm"](info, receiveInstance);
          return exports;
        } catch (e) {
          err("Module.instantiateWasm callback failed with error: " + e);
          return false;
        }
      }

      instantiateAsync().catch(readyPromiseReject);
      return {};
    }

    var tempDouble;
    var tempI64;

    function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();

        if (typeof callback == "function") {
          callback(Module);
          continue;
        }

        var func = callback.func;

        if (typeof func === "number") {
          if (callback.arg === undefined) {
            wasmTable.get(func)();
          } else {
            wasmTable.get(func)(callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }

    function ___cxa_allocate_exception(size) {
      return _malloc(size + 16) + 16;
    }

    function ExceptionInfo(excPtr) {
      this.excPtr = excPtr;
      this.ptr = excPtr - 16;

      this.set_type = function (type) {
        HEAP32[this.ptr + 4 >> 2] = type;
      };

      this.get_type = function () {
        return HEAP32[this.ptr + 4 >> 2];
      };

      this.set_destructor = function (destructor) {
        HEAP32[this.ptr + 8 >> 2] = destructor;
      };

      this.get_destructor = function () {
        return HEAP32[this.ptr + 8 >> 2];
      };

      this.set_refcount = function (refcount) {
        HEAP32[this.ptr >> 2] = refcount;
      };

      this.set_caught = function (caught) {
        caught = caught ? 1 : 0;
        HEAP8[this.ptr + 12 >> 0] = caught;
      };

      this.get_caught = function () {
        return HEAP8[this.ptr + 12 >> 0] != 0;
      };

      this.set_rethrown = function (rethrown) {
        rethrown = rethrown ? 1 : 0;
        HEAP8[this.ptr + 13 >> 0] = rethrown;
      };

      this.get_rethrown = function () {
        return HEAP8[this.ptr + 13 >> 0] != 0;
      };

      this.init = function (type, destructor) {
        this.set_type(type);
        this.set_destructor(destructor);
        this.set_refcount(0);
        this.set_caught(false);
        this.set_rethrown(false);
      };

      this.add_ref = function () {
        var value = HEAP32[this.ptr >> 2];
        HEAP32[this.ptr >> 2] = value + 1;
      };

      this.release_ref = function () {
        var prev = HEAP32[this.ptr >> 2];
        HEAP32[this.ptr >> 2] = prev - 1;
        return prev === 1;
      };
    }

    var exceptionLast = 0;
    var uncaughtExceptionCount = 0;

    function ___cxa_throw(ptr, type, destructor) {
      var info = new ExceptionInfo(ptr);
      info.init(type, destructor);
      exceptionLast = ptr;
      uncaughtExceptionCount++;
      throw ptr;
    }

    function setErrNo(value) {
      HEAP32[___errno_location() >> 2] = value;
      return value;
    }

    var PATH = {
      splitPath: function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },
      normalizeArray: function (parts, allowAboveRoot) {
        var up = 0;

        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];

          if (last === ".") {
            parts.splice(i, 1);
          } else if (last === "..") {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }

        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift("..");
          }
        }

        return parts;
      },
      normalize: function (path) {
        var isAbsolute = path.charAt(0) === "/",
            trailingSlash = path.substr(-1) === "/";
        path = PATH.normalizeArray(path.split("/").filter(function (p) {
          return !!p;
        }), !isAbsolute).join("/");

        if (!path && !isAbsolute) {
          path = ".";
        }

        if (path && trailingSlash) {
          path += "/";
        }

        return (isAbsolute ? "/" : "") + path;
      },
      dirname: function (path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];

        if (!root && !dir) {
          return ".";
        }

        if (dir) {
          dir = dir.substr(0, dir.length - 1);
        }

        return root + dir;
      },
      basename: function (path) {
        if (path === "/") return "/";
        path = PATH.normalize(path);
        path = path.replace(/\/$/, "");
        var lastSlash = path.lastIndexOf("/");
        if (lastSlash === -1) return path;
        return path.substr(lastSlash + 1);
      },
      extname: function (path) {
        return PATH.splitPath(path)[3];
      },
      join: function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join("/"));
      },
      join2: function (l, r) {
        return PATH.normalize(l + "/" + r);
      }
    };

    function getRandomDevice() {
      if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
        var randomBuffer = new Uint8Array(1);
        return function () {
          crypto.getRandomValues(randomBuffer);
          return randomBuffer[0];
        };
      } else return function () {
        abort("randomDevice");
      };
    }

    var PATH_FS = {
      resolve: function () {
        var resolvedPath = "",
            resolvedAbsolute = false;

        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = i >= 0 ? arguments[i] : FS.cwd();

          if (typeof path !== "string") {
            throw new TypeError("Arguments to path.resolve must be strings");
          } else if (!path) {
            return "";
          }

          resolvedPath = path + "/" + resolvedPath;
          resolvedAbsolute = path.charAt(0) === "/";
        }

        resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function (p) {
          return !!p;
        }), !resolvedAbsolute).join("/");
        return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
      },
      relative: function (from, to) {
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);

        function trim(arr) {
          var start = 0;

          for (; start < arr.length; start++) {
            if (arr[start] !== "") break;
          }

          var end = arr.length - 1;

          for (; end >= 0; end--) {
            if (arr[end] !== "") break;
          }

          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }

        var fromParts = trim(from.split("/"));
        var toParts = trim(to.split("/"));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;

        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }

        var outputParts = [];

        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push("..");
        }

        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join("/");
      }
    };
    var TTY = {
      ttys: [],
      init: function () {},
      shutdown: function () {},
      register: function (dev, ops) {
        TTY.ttys[dev] = {
          input: [],
          output: [],
          ops: ops
        };
        FS.registerDevice(dev, TTY.stream_ops);
      },
      stream_ops: {
        open: function (stream) {
          var tty = TTY.ttys[stream.node.rdev];

          if (!tty) {
            throw new FS.ErrnoError(43);
          }

          stream.tty = tty;
          stream.seekable = false;
        },
        close: function (stream) {
          stream.tty.ops.flush(stream.tty);
        },
        flush: function (stream) {
          stream.tty.ops.flush(stream.tty);
        },
        read: function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }

          var bytesRead = 0;

          for (var i = 0; i < length; i++) {
            var result;

            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }

            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }

            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset + i] = result;
          }

          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }

          return bytesRead;
        },
        write: function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }

          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }

          if (length) {
            stream.node.timestamp = Date.now();
          }

          return i;
        }
      },
      default_tty_ops: {
        get_char: function (tty) {
          if (!tty.input.length) {
            var result = null;

            if (typeof window != "undefined" && typeof window.prompt == "function") {
              result = window.prompt("Input: ");

              if (result !== null) {
                result += "\n";
              }
            } else if (typeof readline == "function") {
              result = readline();

              if (result !== null) {
                result += "\n";
              }
            }

            if (!result) {
              return null;
            }

            tty.input = intArrayFromString(result, true);
          }

          return tty.input.shift();
        },
        put_char: function (tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
        flush: function (tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }
      },
      default_tty1_ops: {
        put_char: function (tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
        flush: function (tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }
      }
    };

    function zeroMemory(address, size) {
      HEAPU8.fill(0, address, address + size);
    }

    function alignMemory(size, alignment) {
      return Math.ceil(size / alignment) * alignment;
    }

    function mmapAlloc(size) {
      size = alignMemory(size, 65536);

      var ptr = _memalign(65536, size);

      if (!ptr) return 0;
      zeroMemory(ptr, size);
      return ptr;
    }

    var MEMFS = {
      ops_table: null,
      mount: function (mount) {
        return MEMFS.createNode(null, "/", 16384 | 511, 0);
      },
      createNode: function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          throw new FS.ErrnoError(63);
        }

        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }

        var node = FS.createNode(parent, name, mode, dev);

        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0;
          node.contents = null;
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }

        node.timestamp = Date.now();

        if (parent) {
          parent.contents[name] = node;
          parent.timestamp = node.timestamp;
        }

        return node;
      },
      getFileDataAsTypedArray: function (node) {
        if (!node.contents) return new Uint8Array(0);
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
        return new Uint8Array(node.contents);
      },
      expandFileStorage: function (node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity) return;
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity);
        if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
      },
      resizeFileStorage: function (node, newSize) {
        if (node.usedBytes == newSize) return;

        if (newSize == 0) {
          node.contents = null;
          node.usedBytes = 0;
        } else {
          var oldContents = node.contents;
          node.contents = new Uint8Array(newSize);

          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
          }

          node.usedBytes = newSize;
        }
      },
      node_ops: {
        getattr: function (node) {
          var attr = {};
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;

          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }

          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },
        setattr: function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }

          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }

          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },
        lookup: function (parent, name) {
          throw FS.genericErrors[44];
        },
        mknod: function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },
        rename: function (old_node, new_dir, new_name) {
          if (FS.isDir(old_node.mode)) {
            var new_node;

            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {}

            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }

          delete old_node.parent.contents[old_node.name];
          old_node.parent.timestamp = Date.now();
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          new_dir.timestamp = old_node.parent.timestamp;
          old_node.parent = new_dir;
        },
        unlink: function (parent, name) {
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
        rmdir: function (parent, name) {
          var node = FS.lookupNode(parent, name);

          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }

          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
        readdir: function (node) {
          var entries = [".", ".."];

          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }

            entries.push(key);
          }

          return entries;
        },
        symlink: function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
          node.link = oldpath;
          return node;
        },
        readlink: function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }

          return node.link;
        }
      },
      stream_ops: {
        read: function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);

          if (size > 8 && contents.subarray) {
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }

          return size;
        },
        write: function (stream, buffer, offset, length, position, canOwn) {
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }

          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();

          if (buffer.subarray && (!node.contents || node.contents.subarray)) {
            if (canOwn) {
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) {
              node.contents = buffer.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) {
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }

          MEMFS.expandFileStorage(node, position + length);

          if (node.contents.subarray && buffer.subarray) {
            node.contents.set(buffer.subarray(offset, offset + length), position);
          } else {
            for (var i = 0; i < length; i++) {
              node.contents[position + i] = buffer[offset + i];
            }
          }

          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        },
        llseek: function (stream, offset, whence) {
          var position = offset;

          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }

          if (position < 0) {
            throw new FS.ErrnoError(28);
          }

          return position;
        },
        allocate: function (stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },
        mmap: function (stream, address, length, position, prot, flags) {
          if (address !== 0) {
            throw new FS.ErrnoError(28);
          }

          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }

          var ptr;
          var allocated;
          var contents = stream.node.contents;

          if (!(flags & 2) && contents.buffer === buffer) {
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }

            allocated = true;
            ptr = mmapAlloc(length);

            if (!ptr) {
              throw new FS.ErrnoError(48);
            }

            HEAP8.set(contents, ptr);
          }

          return {
            ptr: ptr,
            allocated: allocated
          };
        },
        msync: function (stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }

          if (mmapFlags & 2) {
            return 0;
          }

          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          return 0;
        }
      }
    };

    function asyncLoad(url, onload, onerror, noRunDep) {
      var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
      readAsync(url, function (arrayBuffer) {
        assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
        onload(new Uint8Array(arrayBuffer));
        if (dep) removeRunDependency(dep);
      }, function (event) {
        if (onerror) {
          onerror();
        } else {
          throw 'Loading data file "' + url + '" failed.';
        }
      });
      if (dep) addRunDependency(dep);
    }

    var FS = {
      root: null,
      mounts: [],
      devices: {},
      streams: [],
      nextInode: 1,
      nameTable: null,
      currentPath: "/",
      initialized: false,
      ignorePermissions: true,
      ErrnoError: null,
      genericErrors: {},
      filesystems: null,
      syncFSRequests: 0,
      lookupPath: function (path, opts) {
        path = PATH_FS.resolve(FS.cwd(), path);
        opts = opts || {};
        if (!path) return {
          path: "",
          node: null
        };
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };

        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }

        if (opts.recurse_count > 8) {
          throw new FS.ErrnoError(32);
        }

        var parts = PATH.normalizeArray(path.split("/").filter(function (p) {
          return !!p;
        }), false);
        var current = FS.root;
        var current_path = "/";

        for (var i = 0; i < parts.length; i++) {
          var islast = i === parts.length - 1;

          if (islast && opts.parent) {
            break;
          }

          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);

          if (FS.isMountpoint(current)) {
            if (!islast || islast && opts.follow_mount) {
              current = current.mounted.root;
            }
          }

          if (!islast || opts.follow) {
            var count = 0;

            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
              var lookup = FS.lookupPath(current_path, {
                recurse_count: opts.recurse_count
              });
              current = lookup.node;

              if (count++ > 40) {
                throw new FS.ErrnoError(32);
              }
            }
          }
        }

        return {
          path: current_path,
          node: current
        };
      },
      getPath: function (node) {
        var path;

        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path;
          }

          path = path ? node.name + "/" + path : node.name;
          node = node.parent;
        }
      },
      hashName: function (parentid, name) {
        var hash = 0;

        for (var i = 0; i < name.length; i++) {
          hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
        }

        return (parentid + hash >>> 0) % FS.nameTable.length;
      },
      hashAddNode: function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },
      hashRemoveNode: function (node) {
        var hash = FS.hashName(node.parent.id, node.name);

        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];

          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }

            current = current.name_next;
          }
        }
      },
      lookupNode: function (parent, name) {
        var errCode = FS.mayLookup(parent);

        if (errCode) {
          throw new FS.ErrnoError(errCode, parent);
        }

        var hash = FS.hashName(parent.id, name);

        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;

          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }

        return FS.lookup(parent, name);
      },
      createNode: function (parent, name, mode, rdev) {
        var node = new FS.FSNode(parent, name, mode, rdev);
        FS.hashAddNode(node);
        return node;
      },
      destroyNode: function (node) {
        FS.hashRemoveNode(node);
      },
      isRoot: function (node) {
        return node === node.parent;
      },
      isMountpoint: function (node) {
        return !!node.mounted;
      },
      isFile: function (mode) {
        return (mode & 61440) === 32768;
      },
      isDir: function (mode) {
        return (mode & 61440) === 16384;
      },
      isLink: function (mode) {
        return (mode & 61440) === 40960;
      },
      isChrdev: function (mode) {
        return (mode & 61440) === 8192;
      },
      isBlkdev: function (mode) {
        return (mode & 61440) === 24576;
      },
      isFIFO: function (mode) {
        return (mode & 61440) === 4096;
      },
      isSocket: function (mode) {
        return (mode & 49152) === 49152;
      },
      flagModes: {
        "r": 0,
        "r+": 2,
        "w": 577,
        "w+": 578,
        "a": 1089,
        "a+": 1090
      },
      modeStringToFlags: function (str) {
        var flags = FS.flagModes[str];

        if (typeof flags === "undefined") {
          throw new Error("Unknown file open mode: " + str);
        }

        return flags;
      },
      flagsToPermissionString: function (flag) {
        var perms = ["r", "w", "rw"][flag & 3];

        if (flag & 512) {
          perms += "w";
        }

        return perms;
      },
      nodePermissions: function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }

        if (perms.includes("r") && !(node.mode & 292)) {
          return 2;
        } else if (perms.includes("w") && !(node.mode & 146)) {
          return 2;
        } else if (perms.includes("x") && !(node.mode & 73)) {
          return 2;
        }

        return 0;
      },
      mayLookup: function (dir) {
        var errCode = FS.nodePermissions(dir, "x");
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },
      mayCreate: function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {}

        return FS.nodePermissions(dir, "wx");
      },
      mayDelete: function (dir, name, isdir) {
        var node;

        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }

        var errCode = FS.nodePermissions(dir, "wx");

        if (errCode) {
          return errCode;
        }

        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }

          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 31;
          }
        }

        return 0;
      },
      mayOpen: function (node, flags) {
        if (!node) {
          return 44;
        }

        if (FS.isLink(node.mode)) {
          return 32;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
            return 31;
          }
        }

        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },
      MAX_OPEN_FDS: 4096,
      nextfd: function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;

        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }

        throw new FS.ErrnoError(33);
      },
      getStream: function (fd) {
        return FS.streams[fd];
      },
      createStream: function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function () {};

          FS.FSStream.prototype = {
            object: {
              get: function () {
                return this.node;
              },
              set: function (val) {
                this.node = val;
              }
            },
            isRead: {
              get: function () {
                return (this.flags & 2097155) !== 1;
              }
            },
            isWrite: {
              get: function () {
                return (this.flags & 2097155) !== 0;
              }
            },
            isAppend: {
              get: function () {
                return this.flags & 1024;
              }
            }
          };
        }

        var newStream = new FS.FSStream();

        for (var p in stream) {
          newStream[p] = stream[p];
        }

        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },
      closeStream: function (fd) {
        FS.streams[fd] = null;
      },
      chrdev_stream_ops: {
        open: function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          stream.stream_ops = device.stream_ops;

          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },
        llseek: function () {
          throw new FS.ErrnoError(70);
        }
      },
      major: function (dev) {
        return dev >> 8;
      },
      minor: function (dev) {
        return dev & 255;
      },
      makedev: function (ma, mi) {
        return ma << 8 | mi;
      },
      registerDevice: function (dev, ops) {
        FS.devices[dev] = {
          stream_ops: ops
        };
      },
      getDevice: function (dev) {
        return FS.devices[dev];
      },
      getMounts: function (mount) {
        var mounts = [];
        var check = [mount];

        while (check.length) {
          var m = check.pop();
          mounts.push(m);
          check.push.apply(check, m.mounts);
        }

        return mounts;
      },
      syncfs: function (populate, callback) {
        if (typeof populate === "function") {
          callback = populate;
          populate = false;
        }

        FS.syncFSRequests++;

        if (FS.syncFSRequests > 1) {
          err("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work");
        }

        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;

        function doCallback(errCode) {
          FS.syncFSRequests--;
          return callback(errCode);
        }

        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }

            return;
          }

          if (++completed >= mounts.length) {
            doCallback(null);
          }
        }

        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }

          mount.type.syncfs(mount, populate, done);
        });
      },
      mount: function (type, opts, mountpoint) {
        var root = mountpoint === "/";
        var pseudo = !mountpoint;
        var node;

        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, {
            follow_mount: false
          });
          mountpoint = lookup.path;
          node = lookup.node;

          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }

          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }

        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;

        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          node.mounted = mount;

          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }

        return mountRoot;
      },
      unmount: function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, {
          follow_mount: false
        });

        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }

        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];

          while (current) {
            var next = current.name_next;

            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }

            current = next;
          }
        });
        node.mounted = null;
        var idx = node.mount.mounts.indexOf(mount);
        node.mount.mounts.splice(idx, 1);
      },
      lookup: function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },
      mknod: function (path, mode, dev) {
        var lookup = FS.lookupPath(path, {
          parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);

        if (!name || name === "." || name === "..") {
          throw new FS.ErrnoError(28);
        }

        var errCode = FS.mayCreate(parent, name);

        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }

        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }

        return parent.node_ops.mknod(parent, name, mode, dev);
      },
      create: function (path, mode) {
        mode = mode !== undefined ? mode : 438;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },
      mkdir: function (path, mode) {
        mode = mode !== undefined ? mode : 511;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },
      mkdirTree: function (path, mode) {
        var dirs = path.split("/");
        var d = "";

        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += "/" + dirs[i];

          try {
            FS.mkdir(d, mode);
          } catch (e) {
            if (e.errno != 20) throw e;
          }
        }
      },
      mkdev: function (path, mode, dev) {
        if (typeof dev === "undefined") {
          dev = mode;
          mode = 438;
        }

        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },
      symlink: function (oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }

        var lookup = FS.lookupPath(newpath, {
          parent: true
        });
        var parent = lookup.node;

        if (!parent) {
          throw new FS.ErrnoError(44);
        }

        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);

        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }

        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }

        return parent.node_ops.symlink(parent, newname, oldpath);
      },
      rename: function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        var lookup, old_dir, new_dir;
        lookup = FS.lookupPath(old_path, {
          parent: true
        });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, {
          parent: true
        });
        new_dir = lookup.node;
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);

        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }

        var old_node = FS.lookupNode(old_dir, old_name);
        var relative = PATH_FS.relative(old_path, new_dirname);

        if (relative.charAt(0) !== ".") {
          throw new FS.ErrnoError(28);
        }

        relative = PATH_FS.relative(new_path, old_dirname);

        if (relative.charAt(0) !== ".") {
          throw new FS.ErrnoError(55);
        }

        var new_node;

        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {}

        if (old_node === new_node) {
          return;
        }

        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);

        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }

        errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);

        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }

        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }

        if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
          throw new FS.ErrnoError(10);
        }

        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, "w");

          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }

        FS.hashRemoveNode(old_node);

        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          FS.hashAddNode(old_node);
        }
      },
      rmdir: function (path) {
        var lookup = FS.lookupPath(path, {
          parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);

        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }

        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }

        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }

        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
      },
      readdir: function (path) {
        var lookup = FS.lookupPath(path, {
          follow: true
        });
        var node = lookup.node;

        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(54);
        }

        return node.node_ops.readdir(node);
      },
      unlink: function (path) {
        var lookup = FS.lookupPath(path, {
          parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);

        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }

        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }

        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }

        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
      },
      readlink: function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;

        if (!link) {
          throw new FS.ErrnoError(44);
        }

        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }

        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },
      stat: function (path, dontFollow) {
        var lookup = FS.lookupPath(path, {
          follow: !dontFollow
        });
        var node = lookup.node;

        if (!node) {
          throw new FS.ErrnoError(44);
        }

        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(63);
        }

        return node.node_ops.getattr(node);
      },
      lstat: function (path) {
        return FS.stat(path, true);
      },
      chmod: function (path, mode, dontFollow) {
        var node;

        if (typeof path === "string") {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow
          });
          node = lookup.node;
        } else {
          node = path;
        }

        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }

        node.node_ops.setattr(node, {
          mode: mode & 4095 | node.mode & ~4095,
          timestamp: Date.now()
        });
      },
      lchmod: function (path, mode) {
        FS.chmod(path, mode, true);
      },
      fchmod: function (fd, mode) {
        var stream = FS.getStream(fd);

        if (!stream) {
          throw new FS.ErrnoError(8);
        }

        FS.chmod(stream.node, mode);
      },
      chown: function (path, uid, gid, dontFollow) {
        var node;

        if (typeof path === "string") {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow
          });
          node = lookup.node;
        } else {
          node = path;
        }

        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }

        node.node_ops.setattr(node, {
          timestamp: Date.now()
        });
      },
      lchown: function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },
      fchown: function (fd, uid, gid) {
        var stream = FS.getStream(fd);

        if (!stream) {
          throw new FS.ErrnoError(8);
        }

        FS.chown(stream.node, uid, gid);
      },
      truncate: function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }

        var node;

        if (typeof path === "string") {
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          node = lookup.node;
        } else {
          node = path;
        }

        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }

        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }

        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }

        var errCode = FS.nodePermissions(node, "w");

        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }

        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },
      ftruncate: function (fd, len) {
        var stream = FS.getStream(fd);

        if (!stream) {
          throw new FS.ErrnoError(8);
        }

        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }

        FS.truncate(stream.node, len);
      },
      utime: function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, {
          follow: true
        });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },
      open: function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }

        flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === "undefined" ? 438 : mode;

        if (flags & 64) {
          mode = mode & 4095 | 32768;
        } else {
          mode = 0;
        }

        var node;

        if (typeof path === "object") {
          node = path;
        } else {
          path = PATH.normalize(path);

          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {}
        }

        var created = false;

        if (flags & 64) {
          if (node) {
            if (flags & 128) {
              throw new FS.ErrnoError(20);
            }
          } else {
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }

        if (!node) {
          throw new FS.ErrnoError(44);
        }

        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }

        if (flags & 65536 && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }

        if (!created) {
          var errCode = FS.mayOpen(node, flags);

          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }

        if (flags & 512) {
          FS.truncate(node, 0);
        }

        flags &= ~(128 | 512 | 131072);
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          ungotten: [],
          error: false
        }, fd_start, fd_end);

        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }

        if (Module["logReadFiles"] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};

          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
          }
        }

        return stream;
      },
      close: function (stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }

        if (stream.getdents) stream.getdents = null;

        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }

        stream.fd = null;
      },
      isClosed: function (stream) {
        return stream.fd === null;
      },
      llseek: function (stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }

        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }

        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }

        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },
      read: function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }

        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }

        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }

        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }

        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }

        var seeking = typeof position !== "undefined";

        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }

        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },
      write: function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }

        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }

        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }

        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }

        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }

        if (stream.seekable && stream.flags & 1024) {
          FS.llseek(stream, 0, 2);
        }

        var seeking = typeof position !== "undefined";

        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }

        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        return bytesWritten;
      },
      allocate: function (stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }

        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(28);
        }

        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }

        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }

        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(138);
        }

        stream.stream_ops.allocate(stream, offset, length);
      },
      mmap: function (stream, address, length, position, prot, flags) {
        if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2);
        }

        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }

        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }

        return stream.stream_ops.mmap(stream, address, length, position, prot, flags);
      },
      msync: function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }

        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },
      munmap: function (stream) {
        return 0;
      },
      ioctl: function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }

        return stream.stream_ops.ioctl(stream, cmd, arg);
      },
      readFile: function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 0;
        opts.encoding = opts.encoding || "binary";

        if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }

        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);

        if (opts.encoding === "utf8") {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === "binary") {
          ret = buf;
        }

        FS.close(stream);
        return ret;
      },
      writeFile: function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 577;
        var stream = FS.open(path, opts.flags, opts.mode);

        if (typeof data === "string") {
          var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          throw new Error("Unsupported data type");
        }

        FS.close(stream);
      },
      cwd: function () {
        return FS.currentPath;
      },
      chdir: function (path) {
        var lookup = FS.lookupPath(path, {
          follow: true
        });

        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }

        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }

        var errCode = FS.nodePermissions(lookup.node, "x");

        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }

        FS.currentPath = lookup.path;
      },
      createDefaultDirectories: function () {
        FS.mkdir("/tmp");
        FS.mkdir("/home");
        FS.mkdir("/home/web_user");
      },
      createDefaultDevices: function () {
        FS.mkdir("/dev");
        FS.registerDevice(FS.makedev(1, 3), {
          read: function () {
            return 0;
          },
          write: function (stream, buffer, offset, length, pos) {
            return length;
          }
        });
        FS.mkdev("/dev/null", FS.makedev(1, 3));
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev("/dev/tty", FS.makedev(5, 0));
        FS.mkdev("/dev/tty1", FS.makedev(6, 0));
        var random_device = getRandomDevice();
        FS.createDevice("/dev", "random", random_device);
        FS.createDevice("/dev", "urandom", random_device);
        FS.mkdir("/dev/shm");
        FS.mkdir("/dev/shm/tmp");
      },
      createSpecialDirectories: function () {
        FS.mkdir("/proc");
        var proc_self = FS.mkdir("/proc/self");
        FS.mkdir("/proc/self/fd");
        FS.mount({
          mount: function () {
            var node = FS.createNode(proc_self, "fd", 16384 | 511, 73);
            node.node_ops = {
              lookup: function (parent, name) {
                var fd = +name;
                var stream = FS.getStream(fd);
                if (!stream) throw new FS.ErrnoError(8);
                var ret = {
                  parent: null,
                  mount: {
                    mountpoint: "fake"
                  },
                  node_ops: {
                    readlink: function () {
                      return stream.path;
                    }
                  }
                };
                ret.parent = ret;
                return ret;
              }
            };
            return node;
          }
        }, {}, "/proc/self/fd");
      },
      createStandardStreams: function () {
        if (Module["stdin"]) {
          FS.createDevice("/dev", "stdin", Module["stdin"]);
        } else {
          FS.symlink("/dev/tty", "/dev/stdin");
        }

        if (Module["stdout"]) {
          FS.createDevice("/dev", "stdout", null, Module["stdout"]);
        } else {
          FS.symlink("/dev/tty", "/dev/stdout");
        }

        if (Module["stderr"]) {
          FS.createDevice("/dev", "stderr", null, Module["stderr"]);
        } else {
          FS.symlink("/dev/tty1", "/dev/stderr");
        }

        var stdin = FS.open("/dev/stdin", 0);
        var stdout = FS.open("/dev/stdout", 1);
        var stderr = FS.open("/dev/stderr", 1);
      },
      ensureErrnoError: function () {
        if (FS.ErrnoError) return;

        FS.ErrnoError = function ErrnoError(errno, node) {
          this.node = node;

          this.setErrno = function (errno) {
            this.errno = errno;
          };

          this.setErrno(errno);
          this.message = "FS error";
        };

        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        [44].forEach(function (code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = "<generic error, no stack>";
        });
      },
      staticInit: function () {
        FS.ensureErrnoError();
        FS.nameTable = new Array(4096);
        FS.mount(MEMFS, {}, "/");
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
        FS.filesystems = {
          "MEMFS": MEMFS
        };
      },
      init: function (input, output, error) {
        FS.init.initialized = true;
        FS.ensureErrnoError();
        Module["stdin"] = input || Module["stdin"];
        Module["stdout"] = output || Module["stdout"];
        Module["stderr"] = error || Module["stderr"];
        FS.createStandardStreams();
      },
      quit: function () {
        FS.init.initialized = false;
        var fflush = Module["_fflush"];
        if (fflush) fflush(0);

        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];

          if (!stream) {
            continue;
          }

          FS.close(stream);
        }
      },
      getMode: function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },
      findObject: function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);

        if (ret.exists) {
          return ret.object;
        } else {
          return null;
        }
      },
      analyzePath: function (path, dontResolveLastLink) {
        try {
          var lookup = FS.lookupPath(path, {
            follow: !dontResolveLastLink
          });
          path = lookup.path;
        } catch (e) {}

        var ret = {
          isRoot: false,
          exists: false,
          error: 0,
          name: null,
          path: null,
          object: null,
          parentExists: false,
          parentPath: null,
          parentObject: null
        };

        try {
          var lookup = FS.lookupPath(path, {
            parent: true
          });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, {
            follow: !dontResolveLastLink
          });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === "/";
        } catch (e) {
          ret.error = e.errno;
        }

        return ret;
      },
      createPath: function (parent, path, canRead, canWrite) {
        parent = typeof parent === "string" ? parent : FS.getPath(parent);
        var parts = path.split("/").reverse();

        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);

          try {
            FS.mkdir(current);
          } catch (e) {}

          parent = current;
        }

        return current;
      },
      createFile: function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },
      createDataFile: function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);

        if (data) {
          if (typeof data === "string") {
            var arr = new Array(data.length);

            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);

            data = arr;
          }

          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 577);
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }

        return node;
      },
      createDevice: function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        FS.registerDevice(dev, {
          open: function (stream) {
            stream.seekable = false;
          },
          close: function (stream) {
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function (stream, buffer, offset, length, pos) {
            var bytesRead = 0;

            for (var i = 0; i < length; i++) {
              var result;

              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }

              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }

              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset + i] = result;
            }

            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }

            return bytesRead;
          },
          write: function (stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset + i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }

            if (length) {
              stream.node.timestamp = Date.now();
            }

            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },
      forceLoadFile: function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;

        if (typeof XMLHttpRequest !== "undefined") {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (read_) {
          try {
            obj.contents = intArrayFromString(read_(obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        } else {
          throw new Error("Cannot load without read() or XMLHttpRequest.");
        }
      },
      createLazyFile: function (parent, name, url, canRead, canWrite) {
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = [];
        }

        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
          if (idx > this.length - 1 || idx < 0) {
            return undefined;
          }

          var chunkOffset = idx % this.chunkSize;
          var chunkNum = idx / this.chunkSize | 0;
          return this.getter(chunkNum)[chunkOffset];
        };

        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        };

        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          var xhr = new XMLHttpRequest();
          xhr.open("HEAD", url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
          var chunkSize = 1024 * 1024;
          if (!hasByteServing) chunkSize = datalength;

          var doXHR = function (from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
            if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";

            if (xhr.overrideMimeType) {
              xhr.overrideMimeType("text/plain; charset=x-user-defined");
            }

            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);

            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || "", true);
            }
          };

          var lazyArray = this;
          lazyArray.setDataGetter(function (chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum + 1) * chunkSize - 1;
            end = Math.min(end, datalength - 1);

            if (typeof lazyArray.chunks[chunkNum] === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }

            if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });

          if (usesGzip || !datalength) {
            chunkSize = datalength = 1;
            datalength = this.getter(0).length;
            chunkSize = datalength;
            out("LazyFiles on gzip forces download of the whole file when length is accessed");
          }

          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        };

        if (typeof XMLHttpRequest !== "undefined") {
          if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: function () {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }

                return this._length;
              }
            },
            chunkSize: {
              get: function () {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }

                return this._chunkSize;
              }
            }
          });
          var properties = {
            isDevice: false,
            contents: lazyArray
          };
        } else {
          var properties = {
            isDevice: false,
            url: url
          };
        }

        var node = FS.createFile(parent, name, properties, canRead, canWrite);

        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }

        Object.defineProperties(node, {
          usedBytes: {
            get: function () {
              return this.contents.length;
            }
          }
        });
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function (key) {
          var fn = node.stream_ops[key];

          stream_ops[key] = function forceLoadLazyFile() {
            FS.forceLoadFile(node);
            return fn.apply(null, arguments);
          };
        });

        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          FS.forceLoadFile(node);
          var contents = stream.node.contents;
          if (position >= contents.length) return 0;
          var size = Math.min(contents.length - position, length);

          if (contents.slice) {
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents.get(position + i);
            }
          }

          return size;
        };

        node.stream_ops = stream_ops;
        return node;
      },
      createPreloadedFile: function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init();
        var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency("cp " + fullname);

        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();

            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }

            if (onload) onload();
            removeRunDependency(dep);
          }

          var handled = false;
          Module["preloadPlugins"].forEach(function (plugin) {
            if (handled) return;

            if (plugin["canHandle"](fullname)) {
              plugin["handle"](byteArray, fullname, finish, function () {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }

        addRunDependency(dep);

        if (typeof url == "string") {
          asyncLoad(url, function (byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },
      indexedDB: function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },
      DB_NAME: function () {
        return "EM_FS_" + window.location.pathname;
      },
      DB_VERSION: 20,
      DB_STORE_NAME: "FILE_DATA",
      saveFilesToDB: function (paths, onload, onerror) {
        onload = onload || function () {};

        onerror = onerror || function () {};

        var indexedDB = FS.indexedDB();

        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }

        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          out("creating db");
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };

        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0,
              fail = 0,
              total = paths.length;

          function finish() {
            if (fail == 0) onload();else onerror();
          }

          paths.forEach(function (path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);

            putRequest.onsuccess = function putRequest_onsuccess() {
              ok++;
              if (ok + fail == total) finish();
            };

            putRequest.onerror = function putRequest_onerror() {
              fail++;
              if (ok + fail == total) finish();
            };
          });
          transaction.onerror = onerror;
        };

        openRequest.onerror = onerror;
      },
      loadFilesFromDB: function (paths, onload, onerror) {
        onload = onload || function () {};

        onerror = onerror || function () {};

        var indexedDB = FS.indexedDB();

        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }

        openRequest.onupgradeneeded = onerror;

        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;

          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], "readonly");
          } catch (e) {
            onerror(e);
            return;
          }

          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0,
              fail = 0,
              total = paths.length;

          function finish() {
            if (fail == 0) onload();else onerror();
          }

          paths.forEach(function (path) {
            var getRequest = files.get(path);

            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }

              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };

            getRequest.onerror = function getRequest_onerror() {
              fail++;
              if (ok + fail == total) finish();
            };
          });
          transaction.onerror = onerror;
        };

        openRequest.onerror = onerror;
      }
    };
    var SYSCALLS = {
      mappings: {},
      DEFAULT_POLLMASK: 5,
      umask: 511,
      calculateAt: function (dirfd, path, allowEmpty) {
        if (path[0] === "/") {
          return path;
        }

        var dir;

        if (dirfd === -100) {
          dir = FS.cwd();
        } else {
          var dirstream = FS.getStream(dirfd);
          if (!dirstream) throw new FS.ErrnoError(8);
          dir = dirstream.path;
        }

        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44);
          }

          return dir;
        }

        return PATH.join2(dir, path);
      },
      doStat: function (func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            return -54;
          }

          throw e;
        }

        HEAP32[buf >> 2] = stat.dev;
        HEAP32[buf + 4 >> 2] = 0;
        HEAP32[buf + 8 >> 2] = stat.ino;
        HEAP32[buf + 12 >> 2] = stat.mode;
        HEAP32[buf + 16 >> 2] = stat.nlink;
        HEAP32[buf + 20 >> 2] = stat.uid;
        HEAP32[buf + 24 >> 2] = stat.gid;
        HEAP32[buf + 28 >> 2] = stat.rdev;
        HEAP32[buf + 32 >> 2] = 0;
        tempI64 = [stat.size >>> 0, (tempDouble = stat.size, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 40 >> 2] = tempI64[0], HEAP32[buf + 44 >> 2] = tempI64[1];
        HEAP32[buf + 48 >> 2] = 4096;
        HEAP32[buf + 52 >> 2] = stat.blocks;
        HEAP32[buf + 56 >> 2] = stat.atime.getTime() / 1e3 | 0;
        HEAP32[buf + 60 >> 2] = 0;
        HEAP32[buf + 64 >> 2] = stat.mtime.getTime() / 1e3 | 0;
        HEAP32[buf + 68 >> 2] = 0;
        HEAP32[buf + 72 >> 2] = stat.ctime.getTime() / 1e3 | 0;
        HEAP32[buf + 76 >> 2] = 0;
        tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 80 >> 2] = tempI64[0], HEAP32[buf + 84 >> 2] = tempI64[1];
        return 0;
      },
      doMsync: function (addr, stream, len, flags, offset) {
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },
      doMkdir: function (path, mode) {
        path = PATH.normalize(path);
        if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
        FS.mkdir(path, mode, 0);
        return 0;
      },
      doMknod: function (path, mode, dev) {
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;

          default:
            return -28;
        }

        FS.mknod(path, mode, dev);
        return 0;
      },
      doReadlink: function (path, buf, bufsize) {
        if (bufsize <= 0) return -28;
        var ret = FS.readlink(path);
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[buf + len];
        stringToUTF8(ret, buf, bufsize + 1);
        HEAP8[buf + len] = endChar;
        return len;
      },
      doAccess: function (path, amode) {
        if (amode & ~7) {
          return -28;
        }

        var node;
        var lookup = FS.lookupPath(path, {
          follow: true
        });
        node = lookup.node;

        if (!node) {
          return -44;
        }

        var perms = "";
        if (amode & 4) perms += "r";
        if (amode & 2) perms += "w";
        if (amode & 1) perms += "x";

        if (perms && FS.nodePermissions(node, perms)) {
          return -2;
        }

        return 0;
      },
      doDup: function (path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },
      doReadv: function (stream, iov, iovcnt, offset) {
        var ret = 0;

        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[iov + i * 8 >> 2];
          var len = HEAP32[iov + (i * 8 + 4) >> 2];
          var curr = FS.read(stream, HEAP8, ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break;
        }

        return ret;
      },
      doWritev: function (stream, iov, iovcnt, offset) {
        var ret = 0;

        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[iov + i * 8 >> 2];
          var len = HEAP32[iov + (i * 8 + 4) >> 2];
          var curr = FS.write(stream, HEAP8, ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }

        return ret;
      },
      varargs: undefined,
      get: function () {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
        return ret;
      },
      getStr: function (ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
      getStreamFromFD: function (fd) {
        var stream = FS.getStream(fd);
        if (!stream) throw new FS.ErrnoError(8);
        return stream;
      },
      get64: function (low, high) {
        return low;
      }
    };

    function ___sys_fcntl64(fd, cmd, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        var stream = SYSCALLS.getStreamFromFD(fd);

        switch (cmd) {
          case 0:
            {
              var arg = SYSCALLS.get();

              if (arg < 0) {
                return -28;
              }

              var newStream;
              newStream = FS.open(stream.path, stream.flags, 0, arg);
              return newStream.fd;
            }

          case 1:
          case 2:
            return 0;

          case 3:
            return stream.flags;

          case 4:
            {
              var arg = SYSCALLS.get();
              stream.flags |= arg;
              return 0;
            }

          case 12:
            {
              var arg = SYSCALLS.get();
              var offset = 0;
              HEAP16[arg + offset >> 1] = 2;
              return 0;
            }

          case 13:
          case 14:
            return 0;

          case 16:
          case 8:
            return -28;

          case 9:
            setErrNo(28);
            return -1;

          default:
            {
              return -28;
            }
        }
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }

    function ___sys_fstat64(fd, buf) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        return SYSCALLS.doStat(FS.stat, stream.path, buf);
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }

    function ___sys_ioctl(fd, op, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        var stream = SYSCALLS.getStreamFromFD(fd);

        switch (op) {
          case 21509:
          case 21505:
            {
              if (!stream.tty) return -59;
              return 0;
            }

          case 21510:
          case 21511:
          case 21512:
          case 21506:
          case 21507:
          case 21508:
            {
              if (!stream.tty) return -59;
              return 0;
            }

          case 21519:
            {
              if (!stream.tty) return -59;
              var argp = SYSCALLS.get();
              HEAP32[argp >> 2] = 0;
              return 0;
            }

          case 21520:
            {
              if (!stream.tty) return -59;
              return -28;
            }

          case 21531:
            {
              var argp = SYSCALLS.get();
              return FS.ioctl(stream, op, argp);
            }

          case 21523:
            {
              if (!stream.tty) return -59;
              return 0;
            }

          case 21524:
            {
              if (!stream.tty) return -59;
              return 0;
            }

          default:
            abort("bad ioctl syscall " + op);
        }
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }

    function ___sys_madvise1(addr, length, advice) {
      try {
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }

    function syscallMmap2(addr, len, prot, flags, fd, off) {
      off <<= 12;
      var ptr;
      var allocated = false;

      if ((flags & 16) !== 0 && addr % 65536 !== 0) {
        return -28;
      }

      if ((flags & 32) !== 0) {
        ptr = mmapAlloc(len);
        if (!ptr) return -48;
        allocated = true;
      } else {
        var info = FS.getStream(fd);
        if (!info) return -8;
        var res = FS.mmap(info, addr, len, off, prot, flags);
        ptr = res.ptr;
        allocated = res.allocated;
      }

      SYSCALLS.mappings[ptr] = {
        malloc: ptr,
        len: len,
        allocated: allocated,
        fd: fd,
        prot: prot,
        flags: flags,
        offset: off
      };
      return ptr;
    }

    function ___sys_mmap2(addr, len, prot, flags, fd, off) {
      try {
        return syscallMmap2(addr, len, prot, flags, fd, off);
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }

    function syscallMunmap(addr, len) {
      var info = SYSCALLS.mappings[addr];

      if (len === 0 || !info) {
        return -28;
      }

      if (len === info.len) {
        var stream = FS.getStream(info.fd);

        if (stream) {
          if (info.prot & 2) {
            SYSCALLS.doMsync(addr, stream, len, info.flags, info.offset);
          }

          FS.munmap(stream);
        }

        SYSCALLS.mappings[addr] = null;

        if (info.allocated) {
          _free(info.malloc);
        }
      }

      return 0;
    }

    function ___sys_munmap(addr, len) {
      try {
        return syscallMunmap(addr, len);
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }

    function ___sys_open(path, flags, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        var pathname = SYSCALLS.getStr(path);
        var mode = varargs ? SYSCALLS.get() : 0;
        var stream = FS.open(pathname, flags, mode);
        return stream.fd;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }

    function ___sys_stat64(path, buf) {
      try {
        path = SYSCALLS.getStr(path);
        return SYSCALLS.doStat(FS.stat, path, buf);
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }

    function __embind_register_bigint(primitiveType, name, size, minRange, maxRange) {}

    function getShiftFromSize(size) {
      switch (size) {
        case 1:
          return 0;

        case 2:
          return 1;

        case 4:
          return 2;

        case 8:
          return 3;

        default:
          throw new TypeError("Unknown type size: " + size);
      }
    }

    function embind_init_charCodes() {
      var codes = new Array(256);

      for (var i = 0; i < 256; ++i) {
        codes[i] = String.fromCharCode(i);
      }

      embind_charCodes = codes;
    }

    var embind_charCodes = undefined;

    function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;

      while (HEAPU8[c]) {
        ret += embind_charCodes[HEAPU8[c++]];
      }

      return ret;
    }

    var awaitingDependencies = {};
    var registeredTypes = {};
    var typeDependencies = {};
    var char_0 = 48;
    var char_9 = 57;

    function makeLegalFunctionName(name) {
      if (undefined === name) {
        return "_unknown";
      }

      name = name.replace(/[^a-zA-Z0-9_]/g, "$");
      var f = name.charCodeAt(0);

      if (f >= char_0 && f <= char_9) {
        return "_" + name;
      } else {
        return name;
      }
    }

    function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      return new Function("body", "return function " + name + "() {\n" + '    "use strict";' + "    return body.apply(this, arguments);\n" + "};\n")(body);
    }

    function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function (message) {
        this.name = errorName;
        this.message = message;
        var stack = new Error(message).stack;

        if (stack !== undefined) {
          this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "");
        }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;

      errorClass.prototype.toString = function () {
        if (this.message === undefined) {
          return this.name;
        } else {
          return this.name + ": " + this.message;
        }
      };

      return errorClass;
    }

    var BindingError = undefined;

    function throwBindingError(message) {
      throw new BindingError(message);
    }

    var InternalError = undefined;

    function throwInternalError(message) {
      throw new InternalError(message);
    }

    function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function (type) {
        typeDependencies[type] = dependentTypes;
      });

      function onComplete(typeConverters) {
        var myTypeConverters = getTypeConverters(typeConverters);

        if (myTypeConverters.length !== myTypes.length) {
          throwInternalError("Mismatched type converter count");
        }

        for (var i = 0; i < myTypes.length; ++i) {
          registerType(myTypes[i], myTypeConverters[i]);
        }
      }

      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function (dt, i) {
        if (registeredTypes.hasOwnProperty(dt)) {
          typeConverters[i] = registeredTypes[dt];
        } else {
          unregisteredTypes.push(dt);

          if (!awaitingDependencies.hasOwnProperty(dt)) {
            awaitingDependencies[dt] = [];
          }

          awaitingDependencies[dt].push(function () {
            typeConverters[i] = registeredTypes[dt];
            ++registered;

            if (registered === unregisteredTypes.length) {
              onComplete(typeConverters);
            }
          });
        }
      });

      if (0 === unregisteredTypes.length) {
        onComplete(typeConverters);
      }
    }

    function registerType(rawType, registeredInstance, options) {
      options = options || {};

      if (!("argPackAdvance" in registeredInstance)) {
        throw new TypeError("registerType registeredInstance requires argPackAdvance");
      }

      var name = registeredInstance.name;

      if (!rawType) {
        throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }

      if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
          return;
        } else {
          throwBindingError("Cannot register type '" + name + "' twice");
        }
      }

      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];

      if (awaitingDependencies.hasOwnProperty(rawType)) {
        var callbacks = awaitingDependencies[rawType];
        delete awaitingDependencies[rawType];
        callbacks.forEach(function (cb) {
          cb();
        });
      }
    }

    function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        "fromWireType": function (wt) {
          return !!wt;
        },
        "toWireType": function (destructors, o) {
          return o ? trueValue : falseValue;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": function (pointer) {
          var heap;

          if (size === 1) {
            heap = HEAP8;
          } else if (size === 2) {
            heap = HEAP16;
          } else if (size === 4) {
            heap = HEAP32;
          } else {
            throw new TypeError("Unknown boolean type size: " + name);
          }

          return this["fromWireType"](heap[pointer >> shift]);
        },
        destructorFunction: null
      });
    }

    function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
        return false;
      }

      if (!(other instanceof ClassHandle)) {
        return false;
      }

      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;

      while (leftClass.baseClass) {
        left = leftClass.upcast(left);
        leftClass = leftClass.baseClass;
      }

      while (rightClass.baseClass) {
        right = rightClass.upcast(right);
        rightClass = rightClass.baseClass;
      }

      return leftClass === rightClass && left === right;
    }

    function shallowCopyInternalPointer(o) {
      return {
        count: o.count,
        deleteScheduled: o.deleteScheduled,
        preservePointerOnDelete: o.preservePointerOnDelete,
        ptr: o.ptr,
        ptrType: o.ptrType,
        smartPtr: o.smartPtr,
        smartPtrType: o.smartPtrType
      };
    }

    function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }

      throwBindingError(getInstanceTypeName(obj) + " instance already deleted");
    }

    var finalizationGroup = false;

    function detachFinalizer(handle) {}

    function runDestructor($$) {
      if ($$.smartPtr) {
        $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
        $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }

    function releaseClassHandle($$) {
      $$.count.value -= 1;
      var toDelete = 0 === $$.count.value;

      if (toDelete) {
        runDestructor($$);
      }
    }

    function attachFinalizer(handle) {
      if ("undefined" === typeof FinalizationGroup) {
        attachFinalizer = function (handle) {
          return handle;
        };

        return handle;
      }

      finalizationGroup = new FinalizationGroup(function (iter) {
        for (var result = iter.next(); !result.done; result = iter.next()) {
          var $$ = result.value;

          if (!$$.ptr) {
            console.warn("object already deleted: " + $$.ptr);
          } else {
            releaseClassHandle($$);
          }
        }
      });

      attachFinalizer = function (handle) {
        finalizationGroup.register(handle, handle.$$, handle.$$);
        return handle;
      };

      detachFinalizer = function (handle) {
        finalizationGroup.unregister(handle.$$);
      };

      return attachFinalizer(handle);
    }

    function ClassHandle_clone() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }

      if (this.$$.preservePointerOnDelete) {
        this.$$.count.value += 1;
        return this;
      } else {
        var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), {
          $$: {
            value: shallowCopyInternalPointer(this.$$)
          }
        }));
        clone.$$.count.value += 1;
        clone.$$.deleteScheduled = false;
        return clone;
      }
    }

    function ClassHandle_delete() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }

      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError("Object already scheduled for deletion");
      }

      detachFinalizer(this);
      releaseClassHandle(this.$$);

      if (!this.$$.preservePointerOnDelete) {
        this.$$.smartPtr = undefined;
        this.$$.ptr = undefined;
      }
    }

    function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }

    var delayFunction = undefined;
    var deletionQueue = [];

    function flushPendingDeletes() {
      while (deletionQueue.length) {
        var obj = deletionQueue.pop();
        obj.$$.deleteScheduled = false;
        obj["delete"]();
      }
    }

    function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }

      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError("Object already scheduled for deletion");
      }

      deletionQueue.push(this);

      if (deletionQueue.length === 1 && delayFunction) {
        delayFunction(flushPendingDeletes);
      }

      this.$$.deleteScheduled = true;
      return this;
    }

    function init_ClassHandle() {
      ClassHandle.prototype["isAliasOf"] = ClassHandle_isAliasOf;
      ClassHandle.prototype["clone"] = ClassHandle_clone;
      ClassHandle.prototype["delete"] = ClassHandle_delete;
      ClassHandle.prototype["isDeleted"] = ClassHandle_isDeleted;
      ClassHandle.prototype["deleteLater"] = ClassHandle_deleteLater;
    }

    function ClassHandle() {}

    var registeredPointers = {};

    function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
        var prevFunc = proto[methodName];

        proto[methodName] = function () {
          if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
            throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
          }

          return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
        };

        proto[methodName].overloadTable = [];
        proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }

    function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
        if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
          throwBindingError("Cannot register public name '" + name + "' twice");
        }

        ensureOverloadTable(Module, name, name);

        if (Module.hasOwnProperty(numArguments)) {
          throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
        }

        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;

        if (undefined !== numArguments) {
          Module[name].numArguments = numArguments;
        }
      }
    }

    function RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }

    function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
        if (!ptrClass.upcast) {
          throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
        }

        ptr = ptrClass.upcast(ptr);
        ptrClass = ptrClass.baseClass;
      }

      return ptr;
    }

    function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
        if (this.isReference) {
          throwBindingError("null is not a valid " + this.name);
        }

        return 0;
      }

      if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }

      if (!handle.$$.ptr) {
        throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
      }

      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }

    function genericPointerToWireType(destructors, handle) {
      var ptr;

      if (handle === null) {
        if (this.isReference) {
          throwBindingError("null is not a valid " + this.name);
        }

        if (this.isSmartPointer) {
          ptr = this.rawConstructor();

          if (destructors !== null) {
            destructors.push(this.rawDestructor, ptr);
          }

          return ptr;
        } else {
          return 0;
        }
      }

      if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }

      if (!handle.$$.ptr) {
        throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
      }

      if (!this.isConst && handle.$$.ptrType.isConst) {
        throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
      }

      var handleClass = handle.$$.ptrType.registeredClass;
      ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);

      if (this.isSmartPointer) {
        if (undefined === handle.$$.smartPtr) {
          throwBindingError("Passing raw pointer to smart pointer is illegal");
        }

        switch (this.sharingPolicy) {
          case 0:
            if (handle.$$.smartPtrType === this) {
              ptr = handle.$$.smartPtr;
            } else {
              throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
            }

            break;

          case 1:
            ptr = handle.$$.smartPtr;
            break;

          case 2:
            if (handle.$$.smartPtrType === this) {
              ptr = handle.$$.smartPtr;
            } else {
              var clonedHandle = handle["clone"]();
              ptr = this.rawShare(ptr, __emval_register(function () {
                clonedHandle["delete"]();
              }));

              if (destructors !== null) {
                destructors.push(this.rawDestructor, ptr);
              }
            }

            break;

          default:
            throwBindingError("Unsupporting sharing policy");
        }
      }

      return ptr;
    }

    function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
        if (this.isReference) {
          throwBindingError("null is not a valid " + this.name);
        }

        return 0;
      }

      if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }

      if (!handle.$$.ptr) {
        throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
      }

      if (handle.$$.ptrType.isConst) {
        throwBindingError("Cannot convert argument of type " + handle.$$.ptrType.name + " to parameter type " + this.name);
      }

      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }

    function simpleReadValueFromPointer(pointer) {
      return this["fromWireType"](HEAPU32[pointer >> 2]);
    }

    function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
        ptr = this.rawGetPointee(ptr);
      }

      return ptr;
    }

    function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
        this.rawDestructor(ptr);
      }
    }

    function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
        handle["delete"]();
      }
    }

    function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
        return ptr;
      }

      if (undefined === desiredClass.baseClass) {
        return null;
      }

      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);

      if (rv === null) {
        return null;
      }

      return desiredClass.downcast(rv);
    }

    function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }

    function getLiveInheritedInstances() {
      var rv = [];

      for (var k in registeredInstances) {
        if (registeredInstances.hasOwnProperty(k)) {
          rv.push(registeredInstances[k]);
        }
      }

      return rv;
    }

    function setDelayFunction(fn) {
      delayFunction = fn;

      if (deletionQueue.length && delayFunction) {
        delayFunction(flushPendingDeletes);
      }
    }

    function init_embind() {
      Module["getInheritedInstanceCount"] = getInheritedInstanceCount;
      Module["getLiveInheritedInstances"] = getLiveInheritedInstances;
      Module["flushPendingDeletes"] = flushPendingDeletes;
      Module["setDelayFunction"] = setDelayFunction;
    }

    var registeredInstances = {};

    function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
        throwBindingError("ptr should not be undefined");
      }

      while (class_.baseClass) {
        ptr = class_.upcast(ptr);
        class_ = class_.baseClass;
      }

      return ptr;
    }

    function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }

    function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
        throwInternalError("makeClassHandle requires ptr and ptrType");
      }

      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;

      if (hasSmartPtrType !== hasSmartPtr) {
        throwInternalError("Both smartPtrType and smartPtr must be specified");
      }

      record.count = {
        value: 1
      };
      return attachFinalizer(Object.create(prototype, {
        $$: {
          value: record
        }
      }));
    }

    function RegisteredPointer_fromWireType(ptr) {
      var rawPointer = this.getPointee(ptr);

      if (!rawPointer) {
        this.destructor(ptr);
        return null;
      }

      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);

      if (undefined !== registeredInstance) {
        if (0 === registeredInstance.$$.count.value) {
          registeredInstance.$$.ptr = rawPointer;
          registeredInstance.$$.smartPtr = ptr;
          return registeredInstance["clone"]();
        } else {
          var rv = registeredInstance["clone"]();
          this.destructor(ptr);
          return rv;
        }
      }

      function makeDefaultHandle() {
        if (this.isSmartPointer) {
          return makeClassHandle(this.registeredClass.instancePrototype, {
            ptrType: this.pointeeType,
            ptr: rawPointer,
            smartPtrType: this,
            smartPtr: ptr
          });
        } else {
          return makeClassHandle(this.registeredClass.instancePrototype, {
            ptrType: this,
            ptr: ptr
          });
        }
      }

      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];

      if (!registeredPointerRecord) {
        return makeDefaultHandle.call(this);
      }

      var toType;

      if (this.isConst) {
        toType = registeredPointerRecord.constPointerType;
      } else {
        toType = registeredPointerRecord.pointerType;
      }

      var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);

      if (dp === null) {
        return makeDefaultHandle.call(this);
      }

      if (this.isSmartPointer) {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
          ptrType: toType,
          ptr: dp,
          smartPtrType: this,
          smartPtr: ptr
        });
      } else {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
          ptrType: toType,
          ptr: dp
        });
      }
    }

    function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype["argPackAdvance"] = 8;
      RegisteredPointer.prototype["readValueFromPointer"] = simpleReadValueFromPointer;
      RegisteredPointer.prototype["deleteObject"] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype["fromWireType"] = RegisteredPointer_fromWireType;
    }

    function RegisteredPointer(name, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;

      if (!isSmartPointer && registeredClass.baseClass === undefined) {
        if (isConst) {
          this["toWireType"] = constNoSmartPtrRawPointerToWireType;
          this.destructorFunction = null;
        } else {
          this["toWireType"] = nonConstNoSmartPtrRawPointerToWireType;
          this.destructorFunction = null;
        }
      } else {
        this["toWireType"] = genericPointerToWireType;
      }
    }

    function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
        throwInternalError("Replacing nonexistant public symbol");
      }

      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;
        Module[name].argCount = numArguments;
      }
    }

    function dynCallLegacy(sig, ptr, args) {
      var f = Module["dynCall_" + sig];
      return args && args.length ? f.apply(null, [ptr].concat(args)) : f.call(null, ptr);
    }

    function dynCall(sig, ptr, args) {
      if (sig.includes("j")) {
        return dynCallLegacy(sig, ptr, args);
      }

      return wasmTable.get(ptr).apply(null, args);
    }

    function getDynCaller(sig, ptr) {
      var argCache = [];
      return function () {
        argCache.length = arguments.length;

        for (var i = 0; i < arguments.length; i++) {
          argCache[i] = arguments[i];
        }

        return dynCall(sig, ptr, argCache);
      };
    }

    function embind__requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);

      function makeDynCaller() {
        if (signature.includes("j")) {
          return getDynCaller(signature, rawFunction);
        }

        return wasmTable.get(rawFunction);
      }

      var fp = makeDynCaller();

      if (typeof fp !== "function") {
        throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }

      return fp;
    }

    var UnboundTypeError = undefined;

    function getTypeName(type) {
      var ptr = ___getTypeName(type);

      var rv = readLatin1String(ptr);

      _free(ptr);

      return rv;
    }

    function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};

      function visit(type) {
        if (seen[type]) {
          return;
        }

        if (registeredTypes[type]) {
          return;
        }

        if (typeDependencies[type]) {
          typeDependencies[type].forEach(visit);
          return;
        }

        unboundTypes.push(type);
        seen[type] = true;
      }

      types.forEach(visit);
      throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]));
    }

    function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name, destructorSignature, rawDestructor) {
      name = readLatin1String(name);
      getActualType = embind__requireFunction(getActualTypeSignature, getActualType);

      if (upcast) {
        upcast = embind__requireFunction(upcastSignature, upcast);
      }

      if (downcast) {
        downcast = embind__requireFunction(downcastSignature, downcast);
      }

      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
      exposePublicSymbol(legalFunctionName, function () {
        throwUnboundTypeError("Cannot construct " + name + " due to unbound types", [baseClassRawType]);
      });
      whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], function (base) {
        base = base[0];
        var baseClass;
        var basePrototype;

        if (baseClassRawType) {
          baseClass = base.registeredClass;
          basePrototype = baseClass.instancePrototype;
        } else {
          basePrototype = ClassHandle.prototype;
        }

        var constructor = createNamedFunction(legalFunctionName, function () {
          if (Object.getPrototypeOf(this) !== instancePrototype) {
            throw new BindingError("Use 'new' to construct " + name);
          }

          if (undefined === registeredClass.constructor_body) {
            throw new BindingError(name + " has no accessible constructor");
          }

          var body = registeredClass.constructor_body[arguments.length];

          if (undefined === body) {
            throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
          }

          return body.apply(this, arguments);
        });
        var instancePrototype = Object.create(basePrototype, {
          constructor: {
            value: constructor
          }
        });
        constructor.prototype = instancePrototype;
        var registeredClass = new RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
        var referenceConverter = new RegisteredPointer(name, registeredClass, true, false, false);
        var pointerConverter = new RegisteredPointer(name + "*", registeredClass, false, false, false);
        var constPointerConverter = new RegisteredPointer(name + " const*", registeredClass, false, true, false);
        registeredPointers[rawType] = {
          pointerType: pointerConverter,
          constPointerType: constPointerConverter
        };
        replacePublicSymbol(legalFunctionName, constructor);
        return [referenceConverter, pointerConverter, constPointerConverter];
      });
    }

    function heap32VectorToArray(count, firstElement) {
      var array = [];

      for (var i = 0; i < count; i++) {
        array.push(HEAP32[(firstElement >> 2) + i]);
      }

      return array;
    }

    function runDestructors(destructors) {
      while (destructors.length) {
        var ptr = destructors.pop();
        var del = destructors.pop();
        del(ptr);
      }
    }

    function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
      assert(argCount > 0);
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
      whenDependentTypesAreResolved([], [rawClassType], function (classType) {
        classType = classType[0];
        var humanName = "constructor " + classType.name;

        if (undefined === classType.registeredClass.constructor_body) {
          classType.registeredClass.constructor_body = [];
        }

        if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
          throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
        }

        classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
          throwUnboundTypeError("Cannot construct " + classType.name + " due to unbound types", rawArgTypes);
        };

        whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
          argTypes.splice(1, 0, null);
          classType.registeredClass.constructor_body[argCount - 1] = craftInvokerFunction(humanName, argTypes, null, invoker, rawConstructor);
          return [];
        });
        return [];
      });
    }

    function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
        throw new TypeError("new_ called with constructor type " + typeof constructor + " which is not a function");
      }

      var dummy = createNamedFunction(constructor.name || "unknownFunctionName", function () {});
      dummy.prototype = constructor.prototype;
      var obj = new dummy();
      var r = constructor.apply(obj, argumentList);
      return r instanceof Object ? r : obj;
    }

    function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      var argCount = argTypes.length;

      if (argCount < 2) {
        throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }

      var isClassMethodFunc = argTypes[1] !== null && classType !== null;
      var needsDestructorStack = false;

      for (var i = 1; i < argTypes.length; ++i) {
        if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
          needsDestructorStack = true;
          break;
        }
      }

      var returns = argTypes[0].name !== "void";
      var argsList = "";
      var argsListWired = "";

      for (var i = 0; i < argCount - 2; ++i) {
        argsList += (i !== 0 ? ", " : "") + "arg" + i;
        argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired";
      }

      var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\n" + "if (arguments.length !== " + (argCount - 2) + ") {\n" + "throwBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n" + "}\n";

      if (needsDestructorStack) {
        invokerFnBody += "var destructors = [];\n";
      }

      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];

      if (isClassMethodFunc) {
        invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n";
      }

      for (var i = 0; i < argCount - 2; ++i) {
        invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
        args1.push("argType" + i);
        args2.push(argTypes[i + 2]);
      }

      if (isClassMethodFunc) {
        argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }

      invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";

      if (needsDestructorStack) {
        invokerFnBody += "runDestructors(destructors);\n";
      } else {
        for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
          var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";

          if (argTypes[i].destructorFunction !== null) {
            invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
            args1.push(paramName + "_dtor");
            args2.push(argTypes[i].destructorFunction);
          }
        }
      }

      if (returns) {
        invokerFnBody += "var ret = retType.fromWireType(rv);\n" + "return ret;\n";
      } else {}

      invokerFnBody += "}\n";
      args1.push(invokerFnBody);
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }

    function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
      whenDependentTypesAreResolved([], [rawClassType], function (classType) {
        classType = classType[0];
        var humanName = classType.name + "." + methodName;

        if (methodName.startsWith("@@")) {
          methodName = Symbol[methodName.substring(2)];
        }

        if (isPureVirtual) {
          classType.registeredClass.pureVirtualFunctions.push(methodName);
        }

        function unboundTypesHandler() {
          throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes);
        }

        var proto = classType.registeredClass.instancePrototype;
        var method = proto[methodName];

        if (undefined === method || undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2) {
          unboundTypesHandler.argCount = argCount - 2;
          unboundTypesHandler.className = classType.name;
          proto[methodName] = unboundTypesHandler;
        } else {
          ensureOverloadTable(proto, methodName, humanName);
          proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
        }

        whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
          var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);

          if (undefined === proto[methodName].overloadTable) {
            memberFunction.argCount = argCount - 2;
            proto[methodName] = memberFunction;
          } else {
            proto[methodName].overloadTable[argCount - 2] = memberFunction;
          }

          return [];
        });
        return [];
      });
    }

    var emval_free_list = [];
    var emval_handle_array = [{}, {
      value: undefined
    }, {
      value: null
    }, {
      value: true
    }, {
      value: false
    }];

    function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
        emval_handle_array[handle] = undefined;
        emval_free_list.push(handle);
      }
    }

    function count_emval_handles() {
      var count = 0;

      for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
          ++count;
        }
      }

      return count;
    }

    function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
          return emval_handle_array[i];
        }
      }

      return null;
    }

    function init_emval() {
      Module["count_emval_handles"] = count_emval_handles;
      Module["get_first_emval"] = get_first_emval;
    }

    function __emval_register(value) {
      switch (value) {
        case undefined:
          {
            return 1;
          }

        case null:
          {
            return 2;
          }

        case true:
          {
            return 3;
          }

        case false:
          {
            return 4;
          }

        default:
          {
            var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
            emval_handle_array[handle] = {
              refcount: 1,
              value: value
            };
            return handle;
          }
      }
    }

    function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        "fromWireType": function (handle) {
          var rv = emval_handle_array[handle].value;

          __emval_decref(handle);

          return rv;
        },
        "toWireType": function (destructors, value) {
          return __emval_register(value);
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: null
      });
    }

    function enumReadValueFromPointer(name, shift, signed) {
      switch (shift) {
        case 0:
          return function (pointer) {
            var heap = signed ? HEAP8 : HEAPU8;
            return this["fromWireType"](heap[pointer]);
          };

        case 1:
          return function (pointer) {
            var heap = signed ? HEAP16 : HEAPU16;
            return this["fromWireType"](heap[pointer >> 1]);
          };

        case 2:
          return function (pointer) {
            var heap = signed ? HEAP32 : HEAPU32;
            return this["fromWireType"](heap[pointer >> 2]);
          };

        default:
          throw new TypeError("Unknown integer type: " + name);
      }
    }

    function __embind_register_enum(rawType, name, size, isSigned) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);

      function ctor() {}

      ctor.values = {};
      registerType(rawType, {
        name: name,
        constructor: ctor,
        "fromWireType": function (c) {
          return this.constructor.values[c];
        },
        "toWireType": function (destructors, c) {
          return c.value;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": enumReadValueFromPointer(name, shift, isSigned),
        destructorFunction: null
      });
      exposePublicSymbol(name, ctor);
    }

    function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];

      if (undefined === impl) {
        throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }

      return impl;
    }

    function __embind_register_enum_value(rawEnumType, name, enumValue) {
      var enumType = requireRegisteredType(rawEnumType, "enum");
      name = readLatin1String(name);
      var Enum = enumType.constructor;
      var Value = Object.create(enumType.constructor.prototype, {
        value: {
          value: enumValue
        },
        constructor: {
          value: createNamedFunction(enumType.name + "_" + name, function () {})
        }
      });
      Enum.values[enumValue] = Value;
      Enum[name] = Value;
    }

    function _embind_repr(v) {
      if (v === null) {
        return "null";
      }

      var t = typeof v;

      if (t === "object" || t === "array" || t === "function") {
        return v.toString();
      } else {
        return "" + v;
      }
    }

    function floatReadValueFromPointer(name, shift) {
      switch (shift) {
        case 2:
          return function (pointer) {
            return this["fromWireType"](HEAPF32[pointer >> 2]);
          };

        case 3:
          return function (pointer) {
            return this["fromWireType"](HEAPF64[pointer >> 3]);
          };

        default:
          throw new TypeError("Unknown float type: " + name);
      }
    }

    function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        "fromWireType": function (value) {
          return value;
        },
        "toWireType": function (destructors, value) {
          if (typeof value !== "number" && typeof value !== "boolean") {
            throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
          }

          return value;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": floatReadValueFromPointer(name, shift),
        destructorFunction: null
      });
    }

    function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
      var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      name = readLatin1String(name);
      rawInvoker = embind__requireFunction(signature, rawInvoker);
      exposePublicSymbol(name, function () {
        throwUnboundTypeError("Cannot call " + name + " due to unbound types", argTypes);
      }, argCount - 1);
      whenDependentTypesAreResolved([], argTypes, function (argTypes) {
        var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
        replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
        return [];
      });
    }

    function integerReadValueFromPointer(name, shift, signed) {
      switch (shift) {
        case 0:
          return signed ? function readS8FromPointer(pointer) {
            return HEAP8[pointer];
          } : function readU8FromPointer(pointer) {
            return HEAPU8[pointer];
          };

        case 1:
          return signed ? function readS16FromPointer(pointer) {
            return HEAP16[pointer >> 1];
          } : function readU16FromPointer(pointer) {
            return HEAPU16[pointer >> 1];
          };

        case 2:
          return signed ? function readS32FromPointer(pointer) {
            return HEAP32[pointer >> 2];
          } : function readU32FromPointer(pointer) {
            return HEAPU32[pointer >> 2];
          };

        default:
          throw new TypeError("Unknown integer type: " + name);
      }
    }

    function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);

      if (maxRange === -1) {
        maxRange = 4294967295;
      }

      var shift = getShiftFromSize(size);

      var fromWireType = function (value) {
        return value;
      };

      if (minRange === 0) {
        var bitshift = 32 - 8 * size;

        fromWireType = function (value) {
          return value << bitshift >>> bitshift;
        };
      }

      var isUnsignedType = name.includes("unsigned");
      registerType(primitiveType, {
        name: name,
        "fromWireType": fromWireType,
        "toWireType": function (destructors, value) {
          if (typeof value !== "number" && typeof value !== "boolean") {
            throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
          }

          if (value < minRange || value > maxRange) {
            throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!");
          }

          return isUnsignedType ? value >>> 0 : value | 0;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": integerReadValueFromPointer(name, shift, minRange !== 0),
        destructorFunction: null
      });
    }

    function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
      var TA = typeMapping[dataTypeIndex];

      function decodeMemoryView(handle) {
        handle = handle >> 2;
        var heap = HEAPU32;
        var size = heap[handle];
        var data = heap[handle + 1];
        return new TA(buffer, data, size);
      }

      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        "fromWireType": decodeMemoryView,
        "argPackAdvance": 8,
        "readValueFromPointer": decodeMemoryView
      }, {
        ignoreDuplicateRegistrations: true
      });
    }

    function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      var stdStringIsUTF8 = name === "std::string";
      registerType(rawType, {
        name: name,
        "fromWireType": function (value) {
          var length = HEAPU32[value >> 2];
          var str;

          if (stdStringIsUTF8) {
            var decodeStartPtr = value + 4;

            for (var i = 0; i <= length; ++i) {
              var currentBytePtr = value + 4 + i;

              if (i == length || HEAPU8[currentBytePtr] == 0) {
                var maxRead = currentBytePtr - decodeStartPtr;
                var stringSegment = UTF8ToString(decodeStartPtr, maxRead);

                if (str === undefined) {
                  str = stringSegment;
                } else {
                  str += String.fromCharCode(0);
                  str += stringSegment;
                }

                decodeStartPtr = currentBytePtr + 1;
              }
            }
          } else {
            var a = new Array(length);

            for (var i = 0; i < length; ++i) {
              a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
            }

            str = a.join("");
          }

          _free(value);

          return str;
        },
        "toWireType": function (destructors, value) {
          if (value instanceof ArrayBuffer) {
            value = new Uint8Array(value);
          }

          var getLength;
          var valueIsOfTypeString = typeof value === "string";

          if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
            throwBindingError("Cannot pass non-string to std::string");
          }

          if (stdStringIsUTF8 && valueIsOfTypeString) {
            getLength = function () {
              return lengthBytesUTF8(value);
            };
          } else {
            getLength = function () {
              return value.length;
            };
          }

          var length = getLength();

          var ptr = _malloc(4 + length + 1);

          HEAPU32[ptr >> 2] = length;

          if (stdStringIsUTF8 && valueIsOfTypeString) {
            stringToUTF8(value, ptr + 4, length + 1);
          } else {
            if (valueIsOfTypeString) {
              for (var i = 0; i < length; ++i) {
                var charCode = value.charCodeAt(i);

                if (charCode > 255) {
                  _free(ptr);

                  throwBindingError("String has UTF-16 code units that do not fit in 8 bits");
                }

                HEAPU8[ptr + 4 + i] = charCode;
              }
            } else {
              for (var i = 0; i < length; ++i) {
                HEAPU8[ptr + 4 + i] = value[i];
              }
            }
          }

          if (destructors !== null) {
            destructors.push(_free, ptr);
          }

          return ptr;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: function (ptr) {
          _free(ptr);
        }
      });
    }

    function __embind_register_std_wstring(rawType, charSize, name) {
      name = readLatin1String(name);
      var decodeString, encodeString, getHeap, lengthBytesUTF, shift;

      if (charSize === 2) {
        decodeString = UTF16ToString;
        encodeString = stringToUTF16;
        lengthBytesUTF = lengthBytesUTF16;

        getHeap = function () {
          return HEAPU16;
        };

        shift = 1;
      } else if (charSize === 4) {
        decodeString = UTF32ToString;
        encodeString = stringToUTF32;
        lengthBytesUTF = lengthBytesUTF32;

        getHeap = function () {
          return HEAPU32;
        };

        shift = 2;
      }

      registerType(rawType, {
        name: name,
        "fromWireType": function (value) {
          var length = HEAPU32[value >> 2];
          var HEAP = getHeap();
          var str;
          var decodeStartPtr = value + 4;

          for (var i = 0; i <= length; ++i) {
            var currentBytePtr = value + 4 + i * charSize;

            if (i == length || HEAP[currentBytePtr >> shift] == 0) {
              var maxReadBytes = currentBytePtr - decodeStartPtr;
              var stringSegment = decodeString(decodeStartPtr, maxReadBytes);

              if (str === undefined) {
                str = stringSegment;
              } else {
                str += String.fromCharCode(0);
                str += stringSegment;
              }

              decodeStartPtr = currentBytePtr + charSize;
            }
          }

          _free(value);

          return str;
        },
        "toWireType": function (destructors, value) {
          if (!(typeof value === "string")) {
            throwBindingError("Cannot pass non-string to C++ string type " + name);
          }

          var length = lengthBytesUTF(value);

          var ptr = _malloc(4 + length + charSize);

          HEAPU32[ptr >> 2] = length >> shift;
          encodeString(value, ptr + 4, length + charSize);

          if (destructors !== null) {
            destructors.push(_free, ptr);
          }

          return ptr;
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: function (ptr) {
          _free(ptr);
        }
      });
    }

    function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
        isVoid: true,
        name: name,
        "argPackAdvance": 0,
        "fromWireType": function () {
          return undefined;
        },
        "toWireType": function (destructors, o) {
          return undefined;
        }
      });
    }

    function _abort() {
      abort("");
    }

    var _emscripten_get_now;

    _emscripten_get_now = function () {
      return performance.now();
    };

    var _emscripten_get_now_is_monotonic = true;

    function _clock_gettime(clk_id, tp) {
      var now;

      if (clk_id === 0) {
        now = Date.now();
      } else if ((clk_id === 1 || clk_id === 4) && _emscripten_get_now_is_monotonic) {
        now = _emscripten_get_now();
      } else {
        setErrNo(28);
        return -1;
      }

      HEAP32[tp >> 2] = now / 1e3 | 0;
      HEAP32[tp + 4 >> 2] = now % 1e3 * 1e3 * 1e3 | 0;
      return 0;
    }

    function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }

    function emscripten_realloc_buffer(size) {
      try {
        wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1;
      } catch (e) {}
    }

    function _emscripten_resize_heap(requestedSize) {
      var oldSize = HEAPU8.length;
      requestedSize = requestedSize >>> 0;
      var maxHeapSize = 1073741824;

      if (requestedSize > maxHeapSize) {
        return false;
      }

      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
        var replacement = emscripten_realloc_buffer(newSize);

        if (replacement) {
          return true;
        }
      }

      return false;
    }

    var ENV = {};

    function getExecutableName() {
      return thisProgram || "./this.program";
    }

    function getEnvStrings() {
      if (!getEnvStrings.strings) {
        var lang = (typeof navigator === "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8";
        var env = {
          "USER": "web_user",
          "LOGNAME": "web_user",
          "PATH": "/",
          "PWD": "/",
          "HOME": "/home/web_user",
          "LANG": lang,
          "_": getExecutableName()
        };

        for (var x in ENV) {
          if (ENV[x] === undefined) delete env[x];else env[x] = ENV[x];
        }

        var strings = [];

        for (var x in env) {
          strings.push(x + "=" + env[x]);
        }

        getEnvStrings.strings = strings;
      }

      return getEnvStrings.strings;
    }

    function _environ_get(__environ, environ_buf) {
      var bufSize = 0;
      getEnvStrings().forEach(function (string, i) {
        var ptr = environ_buf + bufSize;
        HEAP32[__environ + i * 4 >> 2] = ptr;
        writeAsciiToMemory(string, ptr);
        bufSize += string.length + 1;
      });
      return 0;
    }

    function _environ_sizes_get(penviron_count, penviron_buf_size) {
      var strings = getEnvStrings();
      HEAP32[penviron_count >> 2] = strings.length;
      var bufSize = 0;
      strings.forEach(function (string) {
        bufSize += string.length + 1;
      });
      HEAP32[penviron_buf_size >> 2] = bufSize;
      return 0;
    }

    function _exit(status) {
      exit(status);
    }

    function _fd_close(fd) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        FS.close(stream);
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }

    function _fd_fdstat_get(fd, pbuf) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var type = stream.tty ? 2 : FS.isDir(stream.mode) ? 3 : FS.isLink(stream.mode) ? 7 : 4;
        HEAP8[pbuf >> 0] = type;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }

    function _fd_read(fd, iov, iovcnt, pnum) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = SYSCALLS.doReadv(stream, iov, iovcnt);
        HEAP32[pnum >> 2] = num;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }

    function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var HIGH_OFFSET = 4294967296;
        var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
        var DOUBLE_LIMIT = 9007199254740992;

        if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
          return -61;
        }

        FS.llseek(stream, offset, whence);
        tempI64 = [stream.position >>> 0, (tempDouble = stream.position, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[newOffset >> 2] = tempI64[0], HEAP32[newOffset + 4 >> 2] = tempI64[1];
        if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }

    function _fd_write(fd, iov, iovcnt, pnum) {
      try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = SYSCALLS.doWritev(stream, iov, iovcnt);
        HEAP32[pnum >> 2] = num;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return e.errno;
      }
    }

    function _setTempRet0(val) {
      setTempRet0(val);
    }

    function __isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }

    function __arraySum(array, index) {
      var sum = 0;

      for (var i = 0; i <= index; sum += array[i++]) {}

      return sum;
    }

    var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    function __addDays(date, days) {
      var newDate = new Date(date.getTime());

      while (days > 0) {
        var leap = __isLeapYear(newDate.getFullYear());

        var currentMonth = newDate.getMonth();
        var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];

        if (days > daysInCurrentMonth - newDate.getDate()) {
          days -= daysInCurrentMonth - newDate.getDate() + 1;
          newDate.setDate(1);

          if (currentMonth < 11) {
            newDate.setMonth(currentMonth + 1);
          } else {
            newDate.setMonth(0);
            newDate.setFullYear(newDate.getFullYear() + 1);
          }
        } else {
          newDate.setDate(newDate.getDate() + days);
          return newDate;
        }
      }

      return newDate;
    }

    function _strftime(s, maxsize, format, tm) {
      var tm_zone = HEAP32[tm + 40 >> 2];
      var date = {
        tm_sec: HEAP32[tm >> 2],
        tm_min: HEAP32[tm + 4 >> 2],
        tm_hour: HEAP32[tm + 8 >> 2],
        tm_mday: HEAP32[tm + 12 >> 2],
        tm_mon: HEAP32[tm + 16 >> 2],
        tm_year: HEAP32[tm + 20 >> 2],
        tm_wday: HEAP32[tm + 24 >> 2],
        tm_yday: HEAP32[tm + 28 >> 2],
        tm_isdst: HEAP32[tm + 32 >> 2],
        tm_gmtoff: HEAP32[tm + 36 >> 2],
        tm_zone: tm_zone ? UTF8ToString(tm_zone) : ""
      };
      var pattern = UTF8ToString(format);
      var EXPANSION_RULES_1 = {
        "%c": "%a %b %d %H:%M:%S %Y",
        "%D": "%m/%d/%y",
        "%F": "%Y-%m-%d",
        "%h": "%b",
        "%r": "%I:%M:%S %p",
        "%R": "%H:%M",
        "%T": "%H:%M:%S",
        "%x": "%m/%d/%y",
        "%X": "%H:%M:%S",
        "%Ec": "%c",
        "%EC": "%C",
        "%Ex": "%m/%d/%y",
        "%EX": "%H:%M:%S",
        "%Ey": "%y",
        "%EY": "%Y",
        "%Od": "%d",
        "%Oe": "%e",
        "%OH": "%H",
        "%OI": "%I",
        "%Om": "%m",
        "%OM": "%M",
        "%OS": "%S",
        "%Ou": "%u",
        "%OU": "%U",
        "%OV": "%V",
        "%Ow": "%w",
        "%OW": "%W",
        "%Oy": "%y"
      };

      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule]);
      }

      var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      function leadingSomething(value, digits, character) {
        var str = typeof value === "number" ? value.toString() : value || "";

        while (str.length < digits) {
          str = character[0] + str;
        }

        return str;
      }

      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, "0");
      }

      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : value > 0 ? 1 : 0;
        }

        var compare;

        if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
            compare = sgn(date1.getDate() - date2.getDate());
          }
        }

        return compare;
      }

      function getFirstWeekStartDate(janFourth) {
        switch (janFourth.getDay()) {
          case 0:
            return new Date(janFourth.getFullYear() - 1, 11, 29);

          case 1:
            return janFourth;

          case 2:
            return new Date(janFourth.getFullYear(), 0, 3);

          case 3:
            return new Date(janFourth.getFullYear(), 0, 2);

          case 4:
            return new Date(janFourth.getFullYear(), 0, 1);

          case 5:
            return new Date(janFourth.getFullYear() - 1, 11, 31);

          case 6:
            return new Date(janFourth.getFullYear() - 1, 11, 30);
        }
      }

      function getWeekBasedYear(date) {
        var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);

        var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
        var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
        var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
        var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);

        if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
          if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
            return thisDate.getFullYear() + 1;
          } else {
            return thisDate.getFullYear();
          }
        } else {
          return thisDate.getFullYear() - 1;
        }
      }

      var EXPANSION_RULES_2 = {
        "%a": function (date) {
          return WEEKDAYS[date.tm_wday].substring(0, 3);
        },
        "%A": function (date) {
          return WEEKDAYS[date.tm_wday];
        },
        "%b": function (date) {
          return MONTHS[date.tm_mon].substring(0, 3);
        },
        "%B": function (date) {
          return MONTHS[date.tm_mon];
        },
        "%C": function (date) {
          var year = date.tm_year + 1900;
          return leadingNulls(year / 100 | 0, 2);
        },
        "%d": function (date) {
          return leadingNulls(date.tm_mday, 2);
        },
        "%e": function (date) {
          return leadingSomething(date.tm_mday, 2, " ");
        },
        "%g": function (date) {
          return getWeekBasedYear(date).toString().substring(2);
        },
        "%G": function (date) {
          return getWeekBasedYear(date);
        },
        "%H": function (date) {
          return leadingNulls(date.tm_hour, 2);
        },
        "%I": function (date) {
          var twelveHour = date.tm_hour;
          if (twelveHour == 0) twelveHour = 12;else if (twelveHour > 12) twelveHour -= 12;
          return leadingNulls(twelveHour, 2);
        },
        "%j": function (date) {
          return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3);
        },
        "%m": function (date) {
          return leadingNulls(date.tm_mon + 1, 2);
        },
        "%M": function (date) {
          return leadingNulls(date.tm_min, 2);
        },
        "%n": function () {
          return "\n";
        },
        "%p": function (date) {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return "AM";
          } else {
            return "PM";
          }
        },
        "%S": function (date) {
          return leadingNulls(date.tm_sec, 2);
        },
        "%t": function () {
          return "\t";
        },
        "%u": function (date) {
          return date.tm_wday || 7;
        },
        "%U": function (date) {
          var janFirst = new Date(date.tm_year + 1900, 0, 1);
          var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
          var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);

          if (compareByDay(firstSunday, endDate) < 0) {
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
            var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
            var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
            return leadingNulls(Math.ceil(days / 7), 2);
          }

          return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00";
        },
        "%V": function (date) {
          var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
          var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);

          var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);

          if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
            return "53";
          }

          if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
            return "01";
          }

          var daysDifference;

          if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
            daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate();
          } else {
            daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate();
          }

          return leadingNulls(Math.ceil(daysDifference / 7), 2);
        },
        "%w": function (date) {
          return date.tm_wday;
        },
        "%W": function (date) {
          var janFirst = new Date(date.tm_year, 0, 1);
          var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
          var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);

          if (compareByDay(firstMonday, endDate) < 0) {
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
            var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
            var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
            return leadingNulls(Math.ceil(days / 7), 2);
          }

          return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00";
        },
        "%y": function (date) {
          return (date.tm_year + 1900).toString().substring(2);
        },
        "%Y": function (date) {
          return date.tm_year + 1900;
        },
        "%z": function (date) {
          var off = date.tm_gmtoff;
          var ahead = off >= 0;
          off = Math.abs(off) / 60;
          off = off / 60 * 100 + off % 60;
          return (ahead ? "+" : "-") + String("0000" + off).slice(-4);
        },
        "%Z": function (date) {
          return date.tm_zone;
        },
        "%%": function () {
          return "%";
        }
      };

      for (var rule in EXPANSION_RULES_2) {
        if (pattern.includes(rule)) {
          pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date));
        }
      }

      var bytes = intArrayFromString(pattern, false);

      if (bytes.length > maxsize) {
        return 0;
      }

      writeArrayToMemory(bytes, s);
      return bytes.length - 1;
    }

    function _strftime_l(s, maxsize, format, tm) {
      return _strftime(s, maxsize, format, tm);
    }

    var FSNode = function (parent, name, mode, rdev) {
      if (!parent) {
        parent = this;
      }

      this.parent = parent;
      this.mount = parent.mount;
      this.mounted = null;
      this.id = FS.nextInode++;
      this.name = name;
      this.mode = mode;
      this.node_ops = {};
      this.stream_ops = {};
      this.rdev = rdev;
    };

    var readMode = 292 | 73;
    var writeMode = 146;
    Object.defineProperties(FSNode.prototype, {
      read: {
        get: function () {
          return (this.mode & readMode) === readMode;
        },
        set: function (val) {
          val ? this.mode |= readMode : this.mode &= ~readMode;
        }
      },
      write: {
        get: function () {
          return (this.mode & writeMode) === writeMode;
        },
        set: function (val) {
          val ? this.mode |= writeMode : this.mode &= ~writeMode;
        }
      },
      isFolder: {
        get: function () {
          return FS.isDir(this.mode);
        }
      },
      isDevice: {
        get: function () {
          return FS.isChrdev(this.mode);
        }
      }
    });
    FS.FSNode = FSNode;
    FS.staticInit();
    embind_init_charCodes();
    BindingError = Module["BindingError"] = extendError(Error, "BindingError");
    InternalError = Module["InternalError"] = extendError(Error, "InternalError");
    init_ClassHandle();
    init_RegisteredPointer();
    init_embind();
    UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
    init_emval();

    function intArrayFromString(stringy, dontAddNull, length) {
      var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
      var u8array = new Array(len);
      var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
      if (dontAddNull) u8array.length = numBytesWritten;
      return u8array;
    }

    var asmLibraryArg = {
      "l": ___cxa_allocate_exception,
      "k": ___cxa_throw,
      "o": ___sys_fcntl64,
      "K": ___sys_fstat64,
      "B": ___sys_ioctl,
      "I": ___sys_madvise1,
      "H": ___sys_mmap2,
      "G": ___sys_munmap,
      "p": ___sys_open,
      "J": ___sys_stat64,
      "v": __embind_register_bigint,
      "M": __embind_register_bool,
      "s": __embind_register_class,
      "h": __embind_register_class_constructor,
      "a": __embind_register_class_function,
      "L": __embind_register_emval,
      "n": __embind_register_enum,
      "b": __embind_register_enum_value,
      "q": __embind_register_float,
      "c": __embind_register_function,
      "e": __embind_register_integer,
      "d": __embind_register_memory_view,
      "r": __embind_register_std_string,
      "j": __embind_register_std_wstring,
      "t": __embind_register_void,
      "g": _abort,
      "z": _clock_gettime,
      "x": _emscripten_memcpy_big,
      "y": _emscripten_resize_heap,
      "E": _environ_get,
      "F": _environ_sizes_get,
      "f": _exit,
      "i": _fd_close,
      "D": _fd_fdstat_get,
      "A": _fd_read,
      "u": _fd_seek,
      "m": _fd_write,
      "w": _setTempRet0,
      "C": _strftime_l
    };
    var asm = createWasm();

    var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function () {
      return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["O"]).apply(null, arguments);
    };

    var _malloc = Module["_malloc"] = function () {
      return (_malloc = Module["_malloc"] = Module["asm"]["P"]).apply(null, arguments);
    };

    var _free = Module["_free"] = function () {
      return (_free = Module["_free"] = Module["asm"]["R"]).apply(null, arguments);
    };

    var ___getTypeName = Module["___getTypeName"] = function () {
      return (___getTypeName = Module["___getTypeName"] = Module["asm"]["S"]).apply(null, arguments);
    };

    var ___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = function () {
      return (___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = Module["asm"]["T"]).apply(null, arguments);
    };

    var ___errno_location = Module["___errno_location"] = function () {
      return (___errno_location = Module["___errno_location"] = Module["asm"]["U"]).apply(null, arguments);
    };

    var _memalign = Module["_memalign"] = function () {
      return (_memalign = Module["_memalign"] = Module["asm"]["V"]).apply(null, arguments);
    };

    var dynCall_viijii = Module["dynCall_viijii"] = function () {
      return (dynCall_viijii = Module["dynCall_viijii"] = Module["asm"]["W"]).apply(null, arguments);
    };

    var dynCall_iiiiij = Module["dynCall_iiiiij"] = function () {
      return (dynCall_iiiiij = Module["dynCall_iiiiij"] = Module["asm"]["X"]).apply(null, arguments);
    };

    var dynCall_iiiiijj = Module["dynCall_iiiiijj"] = function () {
      return (dynCall_iiiiijj = Module["dynCall_iiiiijj"] = Module["asm"]["Y"]).apply(null, arguments);
    };

    var dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = function () {
      return (dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = Module["asm"]["Z"]).apply(null, arguments);
    };

    var dynCall_jiji = Module["dynCall_jiji"] = function () {
      return (dynCall_jiji = Module["dynCall_jiji"] = Module["asm"]["_"]).apply(null, arguments);
    };

    var calledRun;

    function ExitStatus(status) {
      this.name = "ExitStatus";
      this.message = "Program terminated with exit(" + status + ")";
      this.status = status;
    }

    dependenciesFulfilled = function runCaller() {
      if (!calledRun) run();
      if (!calledRun) dependenciesFulfilled = runCaller;
    };

    function run(args) {
      args = args || arguments_;

      if (runDependencies > 0) {
        return;
      }

      preRun();

      if (runDependencies > 0) {
        return;
      }

      function doRun() {
        if (calledRun) return;
        calledRun = true;
        Module["calledRun"] = true;
        if (ABORT) return;
        initRuntime();
        readyPromiseResolve(Module);
        if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
        postRun();
      }

      if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(function () {
          setTimeout(function () {
            Module["setStatus"]("");
          }, 1);
          doRun();
        }, 1);
      } else {
        doRun();
      }
    }

    Module["run"] = run;

    function exit(status, implicit) {
      EXITSTATUS = status;

      if (keepRuntimeAlive()) {} else {
        exitRuntime();
      }

      procExit(status);
    }

    function procExit(code) {
      EXITSTATUS = code;

      if (!keepRuntimeAlive()) {
        if (Module["onExit"]) Module["onExit"](code);
        ABORT = true;
      }

      quit_(code, new ExitStatus(code));
    }

    if (Module["preInit"]) {
      if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];

      while (Module["preInit"].length > 0) {
        Module["preInit"].pop()();
      }
    }

    run();
    return Module.ready;
  };
}();

var _default = Module;
exports.default = _default;

}).call(this)}).call(this,require('_process'))
},{"_process":21}],21:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],22:[function(require,module,exports){
"use strict";

var _ffishEs = _interopRequireDefault(require("ffish-es6"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// ffish.js test using chessgroundx
const Chessground = require("chessgroundx").Chessground;

const dropdownVariant = document.getElementById("dropdown-variant");
const buttonSetVariant = document.getElementById("button-set-variant");
const buttonFlip = document.getElementById("button-flip");
const buttonReset = document.getElementById("button-reset");
const buttonUndo = document.getElementById("button-undo");
const rangeVolume = document.getElementById("range-volume");
const buttonAi = document.getElementById("button-ai");
const checkboxAi = document.getElementById("check-auto-ai");
const checkboxDests = document.getElementById("check-dests");
const textFen = document.getElementById("text-fen");
const buttonSetFen = document.getElementById("button-set-fen");
const labelPgn = document.getElementById("label-pgn");
const chessgroundContainerEl = document.getElementById("chessground-container-div");
const chessgroundEl = document.getElementById("chessground-board");
const soundMove = new Audio("assets/sound/thearst3rd/move.wav");
const soundCapture = new Audio("assets/sound/thearst3rd/capture.wav");
const soundCheck = new Audio("assets/sound/thearst3rd/check.wav");
const soundTerminal = new Audio("assets/sound/thearst3rd/terminal.wav");
let ffish = null;
let board = null;
let chessground = null;
let aiTimeout = null;
let premoveTimeout = null;

function initBoard(variant) {
  if (board !== null) board.delete();
  board = new ffish.Board(variant);
  console.log("Variant:", board.variant()); // Change css class for knightmate if needed

  if (board.variant() === "knightmate") {
    if (chessgroundContainerEl.classList.contains("merida")) {
      chessgroundContainerEl.classList.remove("merida");
      chessgroundContainerEl.classList.add("merida-knightmate");
    }

    if (chessgroundContainerEl.classList.contains("tatiana")) {
      chessgroundContainerEl.classList.remove("tatiana");
      chessgroundContainerEl.classList.add("tatiana-knightmate");
    }
  } else {
    if (chessgroundContainerEl.classList.contains("merida-knightmate")) {
      chessgroundContainerEl.classList.remove("merida-knightmate");
      chessgroundContainerEl.classList.add("merida");
    }

    if (chessgroundContainerEl.classList.contains("tatiana-knightmate")) {
      chessgroundContainerEl.classList.remove("tatiana-knightmate");
      chessgroundContainerEl.classList.add("tatiana");
    }
  }
}

new _ffishEs.default().then(loadedModule => {
  ffish = loadedModule;
  console.log("ffish.js initialized!");
  initBoard(dropdownVariant.value);
  const config = {
    fen: "8/8/8/8/8/8/8/8",
    movable: {
      free: false,
      showDests: checkboxDests.checked,
      events: {
        after: afterChessgroundMove
      }
    },
    draggable: {
      showGhost: true
    },
    selectable: {
      enabled: false
    }
  };
  chessground = Chessground(chessgroundEl, config);
  soundMove.volume = rangeVolume.value;
  soundCapture.volume = rangeVolume.value;
  soundCheck.volume = rangeVolume.value;
  soundTerminal.volume = rangeVolume.value;

  buttonSetVariant.onclick = function () {
    initBoard(dropdownVariant.value);
    updateChessground();
    chessground.cancelPremove();
    clearTimeout(aiTimeout);
    clearTimeout(premoveTimeout);
    if (checkboxAi.checked && chessground.state.orientation !== getColor(board)) aiPlayMoveTimeout();
  };

  buttonFlip.onclick = function () {
    chessground.toggleOrientation();
  };

  buttonReset.onclick = function () {
    board.reset();
    updateChessground();
    chessground.cancelPremove();
    clearTimeout(aiTimeout);
    clearTimeout(premoveTimeout);
    if (checkboxAi.checked && chessground.state.orientation !== getColor(board)) aiPlayMoveTimeout();
  };

  buttonUndo.onclick = function () {
    if (board.moveStack().length === 0) return;
    board.pop();
    updateChessground();
    chessground.cancelPremove();
    clearTimeout(aiTimeout);
    clearTimeout(premoveTimeout);
  };

  rangeVolume.oninput = function () {
    soundMove.volume = rangeVolume.value;
    soundCapture.volume = rangeVolume.value;
    soundCheck.volume = rangeVolume.value;
    soundTerminal.volume = rangeVolume.value;
  };

  buttonAi.onclick = function () {
    aiPlayMove();
    chessground.cancelPremove();
    clearTimeout(aiTimeout);
    clearTimeout(premoveTimeout);
  };

  checkboxDests.oninput = function () {
    chessground.set({
      movable: {
        showDests: checkboxDests.checked
      }
    });
  };

  buttonSetFen.onclick = function () {
    const fen = textFen.value;

    if (ffish.validateFen(fen, board.variant())) {
      board.setFen(fen);
      updateChessground();
    } else {
      alert("Invalid FEN");
    }
  };

  updateChessground();
}); // Chessground helper functions

function getDests(board) {
  const dests = {};
  const moves = board.legalMoves().split(" ");

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const from = move.substring(0, 2);
    const to = move.substring(2, 4);
    if (dests[from] === undefined) dests[from] = [];
    dests[from].push(to);
  }

  return dests;
}

function getColorOrUndefined(board) {
  if (board.isGameOver(true)) return undefined;
  return getColor(board);
}

function getColor(board) {
  return board.turn() ? "white" : "black";
}

function getPiecesAsArray(board) {
  // Is board.toString really the best way to get the pieces?
  const pieces = [];
  const piecesLines = board.toString().split(/\r?\n/);

  for (let i = 0; i < piecesLines.length; i++) {
    pieces[piecesLines.length - i - 1] = piecesLines[i].split(" ");
  }

  return pieces;
}

function squareGetCoords(square) {
  if (square.length < 2) return [-1, -1];
  const coords = [-1, -1];
  coords[0] = parseInt(square.substring(1)) - 1;
  if (coords[0] === NaN || coords[0] < 0 || coords[0] >= 1000) return [-1, -1];
  coords[1] = square.charCodeAt(0) - "a".charCodeAt(0);
  if (coords[1] === NaN || coords[1] < 0 || coords[1] >= 26) return [-1, -1];
  return coords;
}

function isCapture(board, move) {
  const pieces = getPiecesAsArray(board);
  const moveFromStr = move.charAt(0) + parseInt(move.substring(1));
  const moveToStr = move.charAt(moveFromStr.length) + parseInt(move.substring(moveFromStr.length + 1));
  const moveFrom = squareGetCoords(moveFromStr);
  const moveTo = squareGetCoords(moveToStr);
  if (pieces[moveTo[0]][moveTo[1]] !== ".") return true; // En passant

  if (pieces[moveFrom[0]][moveFrom[1]].toLowerCase() === "p") return moveFrom[1] !== moveTo[1];
  return false;
}

function aiPlayMove() {
  if (board.isGameOver(true)) return;
  const moves = board.legalMoves().split(" ");
  const move = moves[Math.floor(Math.random() * moves.length)];
  const capture = isCapture(board, move);
  board.push(move);
  afterMove(capture);
}

function aiPlayMoveTimeout() {
  if (board.isGameOver(true)) return;
  const oppColor = board.turn() ? "black" : "white";
  chessground.set({
    movable: {
      color: oppColor
    }
  });
  aiTimeout = setTimeout(() => {
    aiPlayMove();
    const premove = chessground.state.premovable.current;

    if (premove !== undefined) {
      const newMoves = board.legalMoves().split(" "); // Check if premove is legal

      const premoveUci = premove[0] + premove[1];

      for (let i = 0; i < newMoves.length; i++) {
        if (newMoves[i].startsWith(premoveUci)) {
          premoveTimeout = setTimeout(() => {
            chessground.playPremove();
          }, 100);
          return;
        }
      }

      chessground.cancelPremove();
    }
  }, 100);
}

function afterChessgroundMove(orig, dest, metadata) {
  // Auto promote to queen for now
  let promotion = "q";

  if (metadata.ctrlKey) {
    if (board.variant() === "knightmate") promotion = "m";else promotion = "n";
  } else {
    if (board.variant() === "almost") promotion = "c";
  } // TODO, make this way better


  const move = orig + dest;
  const capture = isCapture(board, move);
  if (!board.push(move)) board.push(move + promotion);
  afterMove(capture);
  if (checkboxAi.checked) aiPlayMoveTimeout();
}

function afterMove(capture) {
  updateChessground();

  if (capture) {
    soundCapture.currentTime = 0.0;
    soundCapture.play();
  } else {
    soundMove.currentTime = 0.0;
    soundMove.play();
  }

  if (board.isGameOver(true)) {
    soundTerminal.currentTime = 0.0;
    soundTerminal.play();
  } else if (board.isCheck()) {
    soundCheck.currentTime = 0.0;
    soundCheck.play();
  }
}

function getPgn(board) {
  let pgn = "";
  const reversedMoves = [];
  let moveStack = board.moveStack();

  while (moveStack.length > 0) {
    // TODO: improve this :/
    reversedMoves.push(moveStack.split(" ").pop());
    board.pop();
    moveStack = board.moveStack();
  }

  if (!board.turn() && reversedMoves.length > 0) {
    pgn += board.fullmoveNumber() + "... ";
  }

  while (reversedMoves.length > 0) {
    const move = reversedMoves.pop();

    if (board.turn()) {
      pgn += board.fullmoveNumber() + ". ";
    }

    pgn += board.sanMove(move) + " ";
    board.push(move);
  }

  const result = board.result(true);
  if (result !== "*") pgn += result;
  return pgn.trim();
}

function updateChessground() {
  textFen.value = board.fen();
  labelPgn.innerText = getPgn(board);
  chessground.set({
    fen: board.fen(),
    check: board.isCheck(),
    turnColor: getColor(board),
    movable: {
      color: getColorOrUndefined(board),
      dests: getDests(board)
    }
  });
  const moveStack = board.moveStack();

  if (moveStack.length === 0) {
    chessground.set({
      lastMove: undefined
    });
    buttonUndo.disabled = true;
  } else {
    const lastMove = moveStack.split(" ").pop();
    const lastMoveFrom = lastMove.substring(0, 2);
    const lastMoveTo = lastMove.substring(2, 4);
    chessground.set({
      lastMove: [lastMoveFrom, lastMoveTo]
    });
    buttonUndo.disabled = false;
  }

  if (board.isGameOver(true)) {
    buttonAi.disabled = true;
  } else {
    buttonAi.disabled = false;
  }
}

},{"chessgroundx":4,"ffish-es6":20}]},{},[22]);
