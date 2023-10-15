import { render, createElement, createContext, Component } from 'preact';
import { useState, useRef, useEffect, useContext, useMemo, useErrorBoundary } from 'preact/hooks';

import {Container, Grid, Stack, Paper, Card, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

import { DataGrid } from '@mui/x-data-grid';

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import MessageIcon from '@mui/icons-material/Message';

import Input from '@mui/material/Input';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

const MonitorDataGrid = styled(DataGrid) (({ theme }) => ({
	'& .log--INFO': {
		color: theme.palette.common.white,
		backgroundColor: theme.palette.primary.main,
		'&:hover': {
			backgroundColor: theme.palette.primary.dark
		},
		'&:Mui-selected': {
			backgroundColor: theme.palette.primary.dark
		}
	},
	'& .log--WARN': {
		color: theme.palette.common.white,
		backgroundColor: theme.palette.warning.main,
		'&:hover': {
			backgroundColor: theme.palette.warning.dark
		},
		'&:Mui-selected': {
			backgroundColor: theme.palette.warning.dark
		}
	},
	'& .log--ERROR': {
		color: theme.palette.common.white,
		backgroundColor: theme.palette.error.main,
		'&:hover': {
			backgroundColor: theme.palette.error.dark
		},
		'&:Mui-selected': {
			backgroundColor: theme.palette.error.dark
		}
	},
	'& .log--DEBUG': {
		color: theme.palette.common.white,
		backgroundColor: theme.palette.success.main,
		'&:hover': {
			backgroundColor: theme.palette.success.dark
		},
		'&:Mui-selected': {
			backgroundColor: theme.palette.success.dark
		}
	},
	'& .log--PROTOCOL': {
		color: theme.palette.text.disabled
	},
	'& .log--MESSAGE': {
		// default / fallback
	},
}))


const sliceMessage = (msg) => {
	const id = msg.time
	msg = msg.msg

	const space   = msg.indexOf(' ')
	const newLine = msg.indexOf('\n')

	const command = msg.slice(0, space)
	const route   = msg.slice(space+1, newLine)
	const level   = 
		!(command && route)              ? "ERROR"    :
		command == command.toUpperCase() ? "PROTOCOL" : "MESSAGE"

	const payload = level != "ERROR" ? msg.slice(newLine+1) : msg
	

	return {
		id:      id,
		level:   level,
		command: command,
		route:   route,
		payload: payload
	}
}

const sliceLog = (msg) => {
	const id = msg.time
	msg = msg.msg

	const split = msg.split(',')
	const len   = msg.length
	const level = len <= 1 ? "ERROR" :
		["INFO","WARN","ERROR","DEBUG"].includes(split[0]) ? split[0] : 
		"PROTOCOL"

	if(level != "PROTOCOL") return {
		id:       id,
		level:    level,
		command:  len > 2 ? split[1] : "",
		location: len > 3 ? split[2] : "",
		route:    len > 4 ? split[3] : "",
		details:  len > 5 ? split[4] : "",
	}	

	msg = sliceMessage({time: id, msg: msg})
	return {
		id:       id,
		level:    msg.level,
		command:  msg.command,
		location: "self",
		route:    msg.route,
		details:  msg.payload,
	}
}

const DucqMessageGrid = ({messages}) => {
	const columns = [{
		field: "command",
		headernName: "command",
		width: 100 
	},{
		field: "route",
		headernName: "route",
		flex: .25
	},{
		field: "payload",
		headernName: "payload",
		flex: .50
	}]
	
	const rows = messages.reverse().map(sliceMessage)

	return (
		<MonitorDataGrid rows={rows} columns={columns}
			getRowClassName={params => `log--${params.row.level}`}
		/>
	)
}
const DucqMonitorGrid = ({messages}) => {
	const columns = [{
		field: "command",
		headernName: "command",
		width: 100 
	},{
		field: "location",
		headernName: "location",
		flex: .25
	},{
		field: "route",
		headernName: "route",
		flex: .25
	},{
		field: "details",
		headernName: "details",
		flex: .50
	}]
	
	const rows = messages.reverse().map(sliceLog)

	return (
		<MonitorDataGrid rows={rows} columns={columns}
		getRowClassName={params => `log--${params.row.level}`}
		/>
	)
}

const DucqClient = ({
	host="localhost", port="8080", 
	command="subscribe", route="*", payload="",
	maxMessage=10, MessageListComponent=DucqMessageList
}) => {
	const [messages, setMessages] = useState([])

	const addMessage = (newMessage) => {
		messages.push({time: Date.now(), msg: newMessage})
		if(messages.length > maxMessage)
			messages.shift()
		setMessages(Array.from(messages))
	}
	useEffect(() => {

		const address = `ws://${host}:${port}`
		console.log(`webSocket connection to '${address}'...`);
		const webSocket = new WebSocket(address);

		console.log(webSocket);

		webSocket.onopen  = (event) => {
			console.log("webSocket open", event);
			const msg = `${command} ${route}\n${payload}`;
			console.log("sending ", msg, msg.length);
			webSocket.send(msg);
		}
		webSocket.onmessage = (event) => {
			console.log("webSocket message", event);
			addMessage(event.data)
		}
		webSocket.onclose= (event) => {
			console.log("webSocket close", event);
			addMessage("connection closed.\n" + event.data)
		}
		webSocket.onerror = (event) => {
			console.log("webSocket error", event);
			addMessage("connection error.\n" + event.data)
		}

		return () => webSocket.close()

	}, [host, port])

	return (
		<div>
			<p>{command} to '{route}'</p>
			<MessageListComponent messages={messages} />
		</div>
	)


}
const DucqSender = () => {
	const [message, setMessage] = useState(false)
	const [command, setCommand] = useState("")
	const [route, setRoute]     = useState("")
	const [payload, setPayload] = useState("")
	
	const sendMessage = () => {
		setMessage(false)
		setMessage(true)	
	}

	return (
		<Box sx={{
		display: 'grid',
		p: 1,
		gap: 2,
		gridTemplateColumns: 'repeat(4, 1fr)',
		gridTemplateAreas: `"controls messages messages messages"`,
		}}>

			<Box sx={{gridArea: 'controls', display: 'grid',gap: 2,  gridTemplateRows: 'repeate(4, 1fr)'}}>

			<TextField onChange={ (event)=> {setCommand(event.target.value)} } 
				id="outlined-basic" label="Command" variant="outlined" size="small"/>
			<TextField onChange={(event)=>setRoute(event.target.value)} 
				id="outlined-basic" label="Route" variant="outlined" size="small" />
			<TextField onChange={(event)=>setPayload(event.target.value)} 
				value={payload}
				id="payload" label="Payload" variant="outlined"
				multiline rows={4} maxRows={4}
				/>
			<Box sx={{
			gridAre: 'messages',
			display: 'grid',
			gap: 2,
			gridTemplateColumns: 'repeat(2, 1fr)'}}>
			<Button variant="contained" size="small" onClick={() => sendMessage()}     disabled={ message}>Send</Button>
			<Button variant="contained" size="small" onClick={() => setMessage(false)} disabled={!message} color='error' >Close</Button>
			</Box>

			</Box>

			<Box sx={{gridArea: 'messages'}}>
			{message
				? <DucqClient command={command} route={route} payload={payload} MessageListComponent={DucqMessageGrid}/> 
				: <p></p>}
			</Box>

		</Box>
	)

}


function App() {

	return (
		<div>
			<Accordion >
				<AccordionSummary sx={{color: 'white', bgcolor: 'primary.main'}}
					expandIcon={<ExpandMoreIcon sx={{color: 'white'}} />}
					aria-controls="panel1a-content"
					id="panel1a-header"
				>
					<Typography>Quick client</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<DucqSender/>
				</AccordionDetails>
			</Accordion>
			<Container>
				<Grid container spacing={1}>
					<Grid item md={8}>
						<DucqClient route="__MONITOR__" MessageListComponent={DucqMonitorGrid} />
					</Grid>
					<Grid item md={4}>
						<DucqClient route="*" MessageListComponent={DucqMessageGrid}/>
					</Grid>
				</Grid>
			</Container>
		</div>
	)
}

render(<App />, document.getElementById('app'));
