import React, { Component } from 'react';
import './App.css';
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';
import Grid from 'material-ui/Grid';
import Table, { TableBody, TableCell, TableHead, TableRow } from 'material-ui/Table';
import Paper from 'material-ui/Paper';
import Input, { InputLabel } from 'material-ui/Input';
import { FormControl } from 'material-ui/Form';
import IconButton from 'material-ui/IconButton';
import Button from 'material-ui/Button';
import DeleteIcon from 'material-ui-icons/Delete';
import fire from './fire';

const styles = theme => ({
	app: {
		overflowX: 'auto',
	},
	button: {
		margin: theme.spacing.unit,
	},
	formContainer: {
		marginTop: theme.spacing.unit * 2,
	},
	formControl: {
		margin: theme.spacing.unit,
	},
	formControlButton: {
		margin: theme.spacing.unit,
	},
	alignRight: {
		textAlign: 'right',
	},
	paperTable: {
		marginTop: theme.spacing.unit * 3,
	},
	gridWrapper: {
		textAlign: 'center',
		maxWidth: 700,
		marginLeft  : 'auto',
		marginRight : 'auto'
	}
});

class App extends Component {
	constructor(props) {
		super(props);
		this.state = { words: [], textStateEnglish: "", textStateChinese: "" };
		this.handleClickDelete = this.handleClickDelete.bind(this);
	}
	addWord(e) {
		e.preventDefault();
		var word = {};
		word.textEnglish = this.state.textStateEnglish;
		word.textChinese = this.state.textStateChinese;

		if (word.textEnglish !== "" && word.textChinese !== "") {
			fire.database().ref('words').push( word );
			this.setState({ textStateEnglish: '' });
			this.setState({ textStateChinese: '' });
		} else {
			alert("You forgot something.");
		}
	}
	componentWillMount(){
		let wordsRef = fire.database().ref('words').orderByKey();
		wordsRef.on('child_added', wordNew => {
			let word = { textEnglish: wordNew.val().textEnglish, textChinese: wordNew.val().textChinese, id: wordNew.key };
			this.setState({ words: [word].concat(this.state.words) });
		});
		wordsRef.on('child_removed', wordOld => {
			var array = this.state.words;
			var index = array.findIndex(x => x.id === wordOld.key);

			array.splice(index, 1);
			this.setState({words: array });
		});
	}
	handleChangeEnglish = event => {
		this.setState({ textStateEnglish: event.target.value });
	}
	handleChangeChinese = event => {
		this.setState({ textStateChinese: event.target.value });
	}
	handleClickDelete(itemToRemove) {
		return fire.database().ref('words').child(itemToRemove).remove();
	}
	render() {
		const { classes } = this.props;

		return (
			<div className="App">
				<header className="App-header">
					<Grid container justify="center" wrap="nowrap">
						<Grid item>
							<img src="face.png" alt="my face" className="App-header-photo" />
						</Grid>
						<Grid className="Flex-center">
							<div className="App-title">Chinese Words That Anthony Knows</div>
						</Grid>
						<Grid item>
							<img src="face.png" alt="my face" className="App-header-photo" />
						</Grid>
					</Grid>
				</header>

				<Grid className={classes.gridWrapper}>
					<Grid item>
						<form onSubmit={this.addWord.bind(this)} className={classes.formContainer}>
							<FormControl className={classes.formControl}>
								<InputLabel htmlFor="wordNameInEnglishEl">English Word</InputLabel>
								<Input type="text" id="wordNameInEnglishEl" value={this.state.textStateEnglish} onChange={this.handleChangeEnglish} />
							</FormControl>
							<FormControl className={classes.formControl}>
								<InputLabel htmlFor="wordNameInChineseEl">Chinese Word</InputLabel>
								<Input type="text" id="wordNameInChineseEl" value={this.state.textStateChinese} onChange={this.handleChangeChinese} />
							</FormControl>
							<Button type="submit" variant="raised" className={classes.formControlButton}>
								Add Learned Chinese Word
							</Button>
						</form>
					</Grid>
					<Grid item>
						<Paper justify="center" className={classes.paperTable}>
							<Table>
								<TableHead>
									<TableRow>
										<TableCell>English Words</TableCell>
										<TableCell>Learned Chinese Words</TableCell>
										<TableCell className={classes.alignRight}>Delete</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{this.state.words.map(word => {
										return (
											<TableRow key={word.id} >
												<TableCell>{word.textEnglish}</TableCell>
												<TableCell>{word.textChinese}</TableCell>
												<TableCell className={classes.alignRight}>
													<IconButton
														aria-label="Delete"
														onClick={() => this.handleClickDelete(word.id)}>
														<DeleteIcon />
													</IconButton>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</Paper>
					</Grid>
				</Grid>

				<footer className="App-footer">
					<a href="https://twitter.com/ajgoldenwings" rel="noopener noreferrer" title="Twitter" target="_blank">A site made by Anthony</a>
				</footer>
			</div>
		);
	}
}

App.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(App);
