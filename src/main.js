// ffish.js test using chessgroundx

const Chessground = require("chessgroundx").Chessground

const fenTextEl = document.getElementById("fen-text")
const pgnTextEl = document.getElementById("pgn-text")

const dropdownVariant = document.getElementById("dropdown-variant")
const buttonSetVariant = document.getElementById("button-set-variant")

const buttonFlip = document.getElementById("button-flip")
const buttonReset = document.getElementById("button-reset")
const buttonUndo = document.getElementById("button-undo")
const rangeVolume = document.getElementById("range-volume")
const buttonAi = document.getElementById("button-ai")

const checkboxAi = document.getElementById("check-auto-ai")
const checkboxDests = document.getElementById("check-dests")

const chessgroundContainerEl = document.getElementById("chessground-container-div")
const chessgroundEl = document.getElementById("chessground-board")

const soundMove = new Audio("assets/sound/thearst3rd/move.wav")
const soundCapture = new Audio("assets/sound/thearst3rd/capture.wav")
const soundCheck = new Audio("assets/sound/thearst3rd/check.wav")
const soundTerminal = new Audio("assets/sound/thearst3rd/terminal.wav")

let ffish = null
let board = null
let chessground = null

let aiTimeout = null
let premoveTimeout = null

function initBoard(variant)
{
	if (board !== null)
		board.delete()

	board = new ffish.Board(variant)
	console.log("Variant:", board.variant())

	// Change css class for knightmate if needed
	if (board.variant() === "knightmate")
	{
		if (chessgroundContainerEl.classList.contains("merida"))
		{
			chessgroundContainerEl.classList.remove("merida")
			chessgroundContainerEl.classList.add("merida-knightmate")
		}
		if (chessgroundContainerEl.classList.contains("tatiana"))
		{
			chessgroundContainerEl.classList.remove("tatiana")
			chessgroundContainerEl.classList.add("tatiana-knightmate")
		}
	}
	else
	{
		if (chessgroundContainerEl.classList.contains("merida-knightmate"))
		{
			chessgroundContainerEl.classList.remove("merida-knightmate")
			chessgroundContainerEl.classList.add("merida")
		}
		if (chessgroundContainerEl.classList.contains("tatiana-knightmate"))
		{
			chessgroundContainerEl.classList.remove("tatiana-knightmate")
			chessgroundContainerEl.classList.add("tatiana")
		}
	}
}

import Module from "ffish-es6"
new Module().then(loadedModule =>
{
	ffish = loadedModule
	console.log("ffish.js initialized!")

	initBoard(dropdownVariant.value)

	const config =
	{
		fen: "8/8/8/8/8/8/8/8",
		movable:
		{
			free: false,
			showDests: checkboxDests.checked,
			events:
			{
				after: afterChessgroundMove,
			},
		},
		draggable:
		{
			showGhost: true,
		},
		selectable:
		{
			enabled: false,
		},
	}
	chessground = Chessground(chessgroundEl, config)

	soundMove.volume = rangeVolume.value
	soundCapture.volume = rangeVolume.value
	soundCheck.volume = rangeVolume.value
	soundTerminal.volume = rangeVolume.value

	buttonSetVariant.onclick = function()
	{
		initBoard(dropdownVariant.value)
		updateChessground()
		chessground.cancelPremove()
		clearTimeout(aiTimeout)
		clearTimeout(premoveTimeout)

		if (checkboxAi.checked && chessground.state.orientation === "black")
			aiPlayMoveTimeout()
	}

	buttonFlip.onclick = function()
	{
		chessground.toggleOrientation()
	}
	buttonReset.onclick = function()
	{
		board.reset()
		updateChessground()
		chessground.cancelPremove()
		clearTimeout(aiTimeout)
		clearTimeout(premoveTimeout)

		if (checkboxAi.checked && chessground.state.orientation === "black")
			aiPlayMoveTimeout()
	}
	buttonUndo.onclick = function()
	{
		if (board.moveStack().length === 0)
			return
		board.pop()
		updateChessground()
		chessground.cancelPremove()
		clearTimeout(aiTimeout)
		clearTimeout(premoveTimeout)
	}
	rangeVolume.oninput = function()
	{
		soundMove.volume = rangeVolume.value
		soundCapture.volume = rangeVolume.value
		soundCheck.volume = rangeVolume.value
		soundTerminal.volume = rangeVolume.value
	}
	buttonAi.onclick = function()
	{
		aiPlayMove()

		chessground.cancelPremove()
		clearTimeout(aiTimeout)
		clearTimeout(premoveTimeout)
	}

	checkboxDests.oninput = function()
	{
		chessground.set({
			movable:
			{
				showDests: checkboxDests.checked,
			}
		})
	}

	updateChessground()
})

// Chessground helper functions

function getDests(board)
{
	const dests = {}
	const moves = board.legalMoves().split(" ")
	for (let i = 0; i < moves.length; i++)
	{
		const move = moves[i]
		const from = move.substring(0, 2)
		const to = move.substring(2, 4)
		if (dests[from] === undefined)
			dests[from] = []
		dests[from].push(to)
	}
	return dests
}

function isGameOver(board)
{
	if (board.hasInsufficientMaterial())
		return true;
	if (board.isOptionalGameEnd())
		return true;
	return board.legalMoves().length === 0
}

function getGameResult(board)
{
	let value = 0
	if (!board.hasInsufficientMaterial() && !board.isOptionalGameEnd())
		value = board.gameResult()
	if (!board.turn())
		value = -value

	if (value < 0)
		return "0-1"
	else if (value > 0)
		return "1-0"
	else
		return "1/2-1/2"
}

function getColorOrUndefined(board)
{
	if (isGameOver(board))
		return undefined
	return getColor(board)
}

function getColor(board)
{
	return board.turn() ? "white" : "black"
}

function getPiecesAsArray(board)
{
	// Is board.toString really the best way to get the pieces?
	const pieces = []
	const piecesLines = board.toString().split(/\r?\n/)
	for (let i = 0; i < piecesLines.length; i++)
	{
		pieces[piecesLines.length - i - 1] = piecesLines[i].split(" ")
	}
	return pieces
}

function squareGetCoords(square)
{
	if (square.length < 2)
		return [-1, -1]

	const coords = [-1, -1]
	coords[0] = parseInt(square.substring(1)) - 1
	if (coords[0] === NaN || coords[0] < 0 || coords[0] >= 1000)
		return [-1, -1]
	coords[1] = square.charCodeAt(0) - "a".charCodeAt(0)
	if (coords[1] === NaN || coords[1] < 0 || coords[1] >= 26)
		return [-1, -1]
	return coords
}

function isCapture(board, move)
{
	const pieces = getPiecesAsArray(board)

	const moveFromStr = move.charAt(0) + parseInt(move.substring(1))
	const moveToStr = move.charAt(moveFromStr.length) + parseInt(move.substring(moveFromStr.length + 1))
	const moveFrom = squareGetCoords(moveFromStr)
	const moveTo = squareGetCoords(moveToStr)

	if (pieces[moveTo[0]][moveTo[1]] !== ".")
		return true

	// En passant
	if (pieces[moveFrom[0]][moveFrom[1]].toLowerCase() === "p")
		return (moveFrom[1]) !== (moveTo[1])

	return false
}

function aiPlayMove()
{
	if (isGameOver(board))
		return

	const moves = board.legalMoves().split(" ")
	const move = moves[Math.floor(Math.random() * moves.length)]
	const capture = isCapture(board, move)
	board.push(move)
	afterMove(capture)
}

function aiPlayMoveTimeout()
{
	const oppColor = board.turn() ? "black" : "white"
	chessground.set({
		movable:
		{
			color: oppColor,
		},
	})
	aiTimeout = setTimeout(() =>
	{
		aiPlayMove()

		const premove = chessground.state.premovable.current
		if (premove !== undefined)
		{
			const newMoves = board.legalMoves().split(" ")
			// Check if premove is legal
			const premoveUci = premove[0] + premove[1]
			for (let i = 0; i < newMoves.length; i++)
			{
				if (newMoves[i].startsWith(premoveUci))
				{
					premoveTimeout = setTimeout(() =>
					{
						chessground.playPremove()
					}, 100)
					return
				}
			}
			chessground.cancelPremove()
		}
	}, 100)
}

function afterChessgroundMove(orig, dest, metadata)
{
	// Auto promote to queen for now
	let promotion = "q"
	if (metadata.ctrlKey)
	{
		if (board.variant() === "knightmate")
			promotion = "m"
		else
			promotion = "n"
	}
	else
	{
		if (board.variant() === "almost")
			promotion = "c"
	}
	// TODO, make this way better
	const move = orig + dest
	const capture = isCapture(board, move)
	if (!board.push(move))
		board.push(move + promotion)
	afterMove(capture)

	if (checkboxAi.checked)
		aiPlayMoveTimeout()
}

function afterMove(capture)
{
	updateChessground()

	if (capture)
	{
		soundCapture.currentTime = 0.0
		soundCapture.play()
	}
	else
	{
		soundMove.currentTime = 0.0
		soundMove.play()
	}

	if (isGameOver(board))
	{
		soundTerminal.currentTime = 0.0
		soundTerminal.play()
	}
	else if (board.isCheck())
	{
		soundCheck.currentTime = 0.0
		soundCheck.play()
	}
}

function getPgn(board)
{
	let pgn = ""
	const reversedMoves = []
	let moveStack = board.moveStack()
	while (moveStack.length > 0)
	{
		// TODO: improve this :/
		reversedMoves.push(moveStack.split(" ").pop())
		board.pop()
		moveStack = board.moveStack()
	}
	if (!board.turn() && reversedMoves.length > 0)
	{
		pgn += board.fullmoveNumber() + "... "
	}
	while (reversedMoves.length > 0)
	{
		const move = reversedMoves.pop()
		if (board.turn())
		{
			pgn += board.fullmoveNumber() + ". "
		}
		pgn += board.sanMove(move) + " "
		board.push(move)
	}
	if (isGameOver(board))
		pgn += getGameResult(board)
	return pgn.trim()
}

function updateChessground()
{
	fenTextEl.innerText = board.fen()
	pgnTextEl.innerText = getPgn(board)

	chessground.set({
		fen: board.fen(),
		check: board.isCheck(),
		turnColor: getColor(board),
		movable:
		{
			color: getColorOrUndefined(board),
			dests: getDests(board),
		},
	})

	const moveStack = board.moveStack()
	if (moveStack.length === 0)
	{
		chessground.set({lastMove: undefined})
		buttonUndo.disabled = true
	}
	else
	{
		const lastMove = moveStack.split(" ").pop()
		const lastMoveFrom = lastMove.substring(0, 2)
		const lastMoveTo = lastMove.substring(2, 4)
		chessground.set({lastMove: [lastMoveFrom, lastMoveTo]})
		buttonUndo.disabled = false
	}

	if (isGameOver(board))
	{
		buttonAi.disabled = true
	}
	else
	{
		buttonAi.disabled = false
	}
}
