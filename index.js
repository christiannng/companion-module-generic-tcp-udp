const tcp = require('../../tcp')
const udp = require('../../udp')
const instance_skel = require('../../instance_skel')

class instance extends instance_skel {
	/**
	 * Create an instance of the module
	 *
	 * @param {EventEmitter} system - the brains of the operation
	 * @param {string} id - the instance ID
	 * @param {Object} config - saved user configuration parameters
	 * @since 1.0.0
	 */
	constructor(system, id, config) {
		super(system, id, config)
		this.actions() // export actions
		this.init_presets() // export presets
	}

	updateConfig(config) {
		this.init_presets()

		if (this.udp !== undefined) {
			this.udp.destroy()
			delete this.udp
		}

		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}

		this.config = config

		if (this.config.prot == 'tcp') {
			this.init_tcp()
		}

		if (this.config.prot == 'udp') {
			this.init_udp()
		}
	}

	init() {
		this.init_presets()
		if (this.config.prot == 'tcp') {
			this.init_tcp()
		}

		if (this.config.prot == 'udp') {
			this.init_udp()
		}
	}

	init_udp() {
		if (this.udp !== undefined) {
			this.udp.destroy()
			delete this.udp
		}

		this.status(this.STATE_WARNING, 'Connecting')

		if (this.config.host !== undefined) {
			this.udp = new udp(this.config.host, this.config.port)

			this.udp.on('error', (err) => {
				this.debug('Network error', err)
				this.status(this.STATE_ERROR, err)
				this.log('error', 'Network error: ' + err.message)
			})

			// If we get data, thing should be good
			this.udp.on('data', () => {
				this.status(this.STATE_OK)
			})

			this.udp.on('status_change', (status, message) => {
				this.status(status, message)
			})
		}
	}

	init_tcp() {
		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}

		this.status(this.STATE_WARNING, 'Connecting')

		if (this.config.host) {
			this.socket = new tcp(this.config.host, this.config.port)

			this.socket.on('status_change', (status, message) => {
				this.status(status, message)
			})

			this.socket.on('error', (err) => {
				this.debug('Network error', err)
				this.status(this.STATE_ERROR, err)
				this.log('error', 'Network error: ' + err.message)
			})

			this.socket.on('connect', () => {
				this.status(this.STATE_OK)
				this.debug('Connected')
			})

			this.socket.on('data', (data) => {})
		}
	}

	// Return config fields for web config
	config_fields() {
		return [
			{
				type: 'text',
				id: 'info',
				label: 'Information',
				width: 12,
				value: `
				<div class="alert alert-danger">
					<h3>Streamdeck connect</h3>
					
				</div>
			`,
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 6,
				regex: this.REGEX_IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 2,
				default: 7000,
				regex: this.REGEX_PORT,
			},
			{
				type: 'dropdown',
				id: 'prot',
				label: 'Connect with TCP / UDP',
				default: 'tcp',
				choices: [
					{ id: 'tcp', label: 'TCP' },
					{ id: 'udp', label: 'UDP' },
				],
			},
		]
	}

	// When module gets deleted
	destroy() {
		if (this.socket !== undefined) {
			this.socket.destroy()
		}

		if (this.udp !== undefined) {
			this.udp.destroy()
		}

		this.debug('destroy', this.id)
	}

	CHOICES_END = [
		{ id: '', label: 'None' },
		{ id: '\n', label: 'LF - \\n (Common UNIX/Mac)' },
		{ id: '\r\n', label: 'CRLF - \\r\\n (Common Windows)' },
		{ id: '\r', label: 'CR - \\r (Old MacOS)' },
		{ id: '\x00', label: 'NULL - \\x00 (Can happen)' },
		{ id: '\n\r', label: 'LFCR - \\n\\r (Just stupid)' },
	]

	init_presets() {
		let presets = []
		this.setPresetDefinitions(presets)
	}

	actions(system) {
		this.setActions({
			send: {
				label: 'Send Command',
				options: [
					{
						type: 'textwithvariables',
						id: 'id_send',
						label: 'Command:',
						tooltip: 'Use %hh to insert Hex codes',
						default: '',
						width: 6,
					},
					{
						type: 'dropdown',
						id: 'id_end',
						label: 'Command End Character:',
						default: '\n',
						choices: this.CHOICES_END,
					},
				],
			},
		})
	}

	action(action) {
		let cmd
		let end

		switch (action.action) {
			case 'send':
				this.parseVariables(action.options.id_send, (value) => {
					cmd = unescape(value);
				})
				end = action.options.id_end
				break
		}

		/*
		 * create a binary buffer pre-encoded 'latin1' (8bit no change bytes)
		 * sending a string assumes 'utf8' encoding
		 * which then escapes character values over 0x7F
		 * and destroys the 'binary' content
		 */
		let sendBuf = Buffer.from(cmd + end, 'latin1')

		if (sendBuf != '') {
			if (this.config.prot == 'tcp') {
				this.debug('sending ', sendBuf, 'to', this.config.host)

				if (this.socket !== undefined && this.socket.connected) {
					this.socket.send(sendBuf)
				} else {
					this.debug('Socket not connected :(')
				}
			}

			if (this.config.prot == 'udp') {
				if (this.udp !== undefined) {
					this.debug('sending', sendBuf, 'to', this.config.host)

					this.udp.send(sendBuf)
				}
			}
		}
	}
}
exports = module.exports = instance
