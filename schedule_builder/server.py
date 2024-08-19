from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse
from urllib.parse import unquote_plus
import os
import stat
import sys
from datetime import datetime
import glob
MimeType = str
Response = bytes
mime_types = {
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "ico": "image/x-icon",
    "mp3": "audio/mpeg",
    "txt": "text/plain",
}
submissions = []
event_init = False

def get_body_params(body):
    if not body:
        return {}
    parameters = body.split("&")

    # split each parameter into a (key, value) pair, and escape both
    def split_parameter(parameter):
        k, v = parameter.split("=", 1)
        k_escaped = unquote_plus(k)
        v_escaped = unquote_plus(v)
        return k_escaped, v_escaped

    body_dict = dict(map(split_parameter, parameters))
    print(f"Parsed parameters as: {body_dict}")
    # return a dictionary of the parameters
    return body_dict

#added entry_number for numbering event log list
def submission_to_table(item, entry_number):
    
    
    # declare the row
    table_row = '<tr>\n'
    
    # row consutrction - using \n for easier readability afterward
    table_row += f"<td>{entry_number}.</td>\n"
    table_row += f"<td>{item.get('eventName', '')}</td>\n"
    table_row += f"<td>{item.get('dayOfWeek', '')}</td>\n"
    table_row += f"<td>{item.get('startTime', '')}</td>\n"
    table_row += f"<td>{item.get('endTime', '')}</td>\n"
    table_row += f"<td>{item.get('phone', '')}</td>\n"
    table_row += f"<td>{item.get('location', '')}</td>\n"
    table_row += f"<td>{item.get('extraInfo', '')}</td>\n"
    table_row += f"<td><a href='{item.get('url', '')}'>{item.get('url', '')}</a></td>\n"
    
    # close teh row
    table_row += '</tr>\n\n'
    
    return table_row

# function to find a file in server root directory
def find_file(target):
    # return if target path is already correct
    if os.path.exists(target) and os.path.isfile(target):
        return target

    start_dir = "."

    # otherwise use oswalk to loop through subdirectories
    for dirpath, dirnames, filenames in os.walk(start_dir):
        if target in filenames:
            return os.path.join(dirpath, target)

    return None


# checks a file's permissions   
def check_perm(resource):
    stmode = os.stat(resource).st_mode
    return (getattr(stat, 'S_IROTH') & stmode) > 0


# log's the response to response.log for a request
def log_response(response, request):
    now = datetime.now()
    current_time = now.strftime("%H:%M:%S")
    path = request.split(' ')[1] if len(request.split(' ')) > 1 else 'Unknown'
    log_line = f"{current_time}, [{response['status_code']}, {response['headers']}], {path}\n"
    
    with open("response.log", "a") as log_file:
        log_file.write(log_line)


# function that returns correct mime type of file
def get_mime_type(file_extension):
    if file_extension not in mime_types:
        return "text/plain"
    return mime_types[file_extension]


# function to open file correctly
def open_file(file_path):
    # we call get mime type for correct extension
    file_extension = file_path.rsplit('.', 1)[-1]
    mime_type = get_mime_type(file_extension)

    # open in read for text or read binary for non-text
    if mime_type.startswith("text/") or "javascript" in mime_type or mime_type == "application/json":
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    else:
        with open(file_path, 'rb') as file:
            return file.read()
        

# handles a request for a url
def handle_req(url, body=None):

    # setting default mime and status
    mime_type = "text/html; charset=utf-8"
    status_code = 200

    # Get rid of any query string parameters
    myserv_url = urllib.parse.urlparse(url)
    new_query = urllib.parse.parse_qs(myserv_url.query)
    url, *_ = url.split("?", 1)
    url_path = url.strip("/")
    
    # parse any form parameters submitted via POST
    parameters = get_body_params(body)

    # condition for redirect searching
    if myserv_url.path == "/redirect":
        if 'site' in new_query and 'query' in new_query:
            site = new_query['site'][0]
            search_query = new_query['query'][0]

            # checking the user option
            if site == 'youtube':
                redir_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(search_query)}"
            elif site == 'google':
                redir_url = f"https://www.google.com/search?q={urllib.parse.quote_plus(search_query)}"
            else:
                redir_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(search_query)}"

            # prepare header for returning
            headers = {
                "Location": redir_url,
                "Content-Length": 0,
                "X-Content-Type-Options": "nosniff",
            }
            
            return b'', headers, 307

    # condition for calculator      
    if myserv_url.path == "/calculator":
        try:
            operand1 = float(new_query.get('operand1', [0])[0])
            operand2 = float(new_query.get('operand2', [0])[0])
            operator = new_query.get('operator', [''])[0]

            if operator == '+':
                result = operand1 + operand2
            elif operator == '-':
                result = operand1 - operand2
            elif operator == '*':
                result = operand1 * operand2
            elif operator == '/':
                if operand2 != 0:
                    result = operand1 / operand2
                else:
                    result = "Error: You can't divide by zero!"
            else:
                result = "Error: Operator is invalid!"

        except ValueError:
            result = "Error: Operands are invalid!"

        # prepar header for returning
        headers = {
            "Content-Type": mime_type,
            "Content-Length": len(str(result)),
            "X-Content-Type-Options": "nosniff",
        }
        return str(result).encode(), headers, 200

    # special condition to handle event log
    if url == "/EventLog.html" or url == "/static/html/EventLog.html":
        global submissions
        global event_init
        event_message = ""
        popup = ""
        
        #only append list if body -> POST data
        if body:
            submissions.append(parameters) #add params to sub list for printign all
            popup = "<script> alert('Successfully submitted the form!');</script>"
            event_init = True
        
        if not event_init:
            event_message = """
                            <tr>
                                <td colspan="9" style="text-align: center;">No event history</td>
                            </tr>
                            """
        
        #add all submission rows that exist within submissions and use index for entry_number
        all_submissions = "".join(submission_to_table(submission, index+1) for index, submission in enumerate(submissions))
        
        content = f"""
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <title> Event Submission </title>
                <link rel="stylesheet" href="/static/css/style.css">
            </head>
            <body>     
                <nav>
                    <ul>
                        <li><a href="MySchedule.html">My Schedule &#x1F4C5;</a></li>
                        <li><a href="AboutMe.html">About Me &#128102;</a></li>
                        <li><a href="MyForm.html">Form Input &#128221;</a></li>
                        <li><a href="EventLog.html">Form History &#128337;</a></li>
                        <li><a href="stockQuotes.html">Stocks &#128200;</a></li>
                        <li><a href="MyServer.html">My Server &#128225;</a></li>
                        {popup}
                    </ul>
                </nav>
                
                <h1> Event Submissions </h1>
                <div>
                    <table>
                        <thead>
                            <tr>
                                <th>Entry</th>
                                <th>Event</th>
                                <th>Day</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Phone</th>
                                <th>Location</th>
                                <th>Extra Info</th>
                                <th>URL</th>
                            </tr>
                        </thead>
                        <tbody>
                        
            {event_message}{all_submissions}
            
                        </tbody>
                    </table>
                </div>
            </body>
            </html>"""
        
        # prepare header for returning
        headers = {
            "Content-Type": mime_type,
            "Content-Length": len(content),
            "X-Content-Type-Options": "nosniff",
        }
        
        return content, headers, status_code
    
    # special coniditon to handle file directory link
    if url == "/file-explorer":
        dir_files = '<ul>'
        # iteratore through directory and create file list of href
        try:
            files = os.listdir('files')
            for file_name in files:
                dir_files += f'<li><a href="/files/{file_name}">{file_name}</a></li>'
        except OSError as e:
            dir_files += '<li>Error listing files</li>'
        dir_files += '</ul>'

        # create HTML content using list above and new header
        content = f'<html><body><h1>File Explorer</h1>{dir_files}</body></html>'

        headers = {
            "Content-Type": mime_type,
            "Content-Length": len(content),
            "X-Content-Type-Options": "nosniff",
        }

        return content, headers, status_code
    
    # use find file function to locate file in subdirectory
    file_path = find_file(url_path)

    # conditionals for errors
    if file_path is None:
        file_path = find_file("404.html")
        content = open_file(file_path)
        status_code = 404
    elif not check_perm(file_path):
        file_path = find_file("403.html")
        content = open_file(file_path)
        status_code = 403
    else:
        mime_type = get_mime_type(file_path.rsplit('.', 1)[-1])
        content = open_file(file_path)

    # if img/audio
    if "text" not in mime_type:
        content = bytes(content, 'utf-8') if isinstance(content, str) else content

    headers = {
            "Content-Type": mime_type,
            "Content-Length": len(content),
            "X-Content-Type-Options": "nosniff",
        }
    
    return content, headers, status_code
        



class RequestHandler(BaseHTTPRequestHandler):
    def __c_read_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        body = str(body, encoding="utf-8")
        return body

    def __c_send_response(self, message, response_code, headers):
        # Convert the return value into a byte string for network transmission
        if type(message) == str:
            message = bytes(message, "utf8")
        
        # log the response 
        log_response({
            'status_code': response_code,
            'headers': headers
        }, self.requestline)

        # Send the first line of response.
        self.protocol_version = "HTTP/1.1"
        self.send_response(response_code)

        # Send headers (plus a few we'll handle for you)
        for key, value in headers.items():
            self.send_header(key, value)
        # self.send_header("Content-Length", len(message))
        # self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()

        # Send the file.
        if message:
            self.wfile.write(message)

    # updated GET and POST to accept full header parameter and relay to c_send_response
    def do_GET(self):
        # Call the student-edited server code.
        message, headers, status_code = handle_req(self.path)

        # Convert the return value into a byte string for network transmission
        if type(message) == str:
            message = bytes(message, "utf8")

        self.__c_send_response(
            message,
            status_code,
            headers,
        )

    def do_POST(self):
        body = self.__c_read_body()
        message, headers, status_code = handle_req(self.path, body)

        # Convert the return value into a byte string for network transmission
        if type(message) == str:
            message = bytes(message, "utf8")

        self.__c_send_response(
            message,
            status_code,
            headers,
        )


def run():
    PORT = 9955
    print(f"Starting server http://localhost:{PORT}/")
    server = ("", PORT)
    httpd = HTTPServer(server, RequestHandler)
    httpd.serve_forever()


run()
