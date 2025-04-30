// Utility function to transform message templates
function messageTransformFunction(message, recipient) {
  if (!message || !recipient) return message;
  
  let transformedMessage = message.replace(/{name}/g, recipient.name ? recipient.name.split(" ")[0] : "");
  transformedMessage = transformedMessage.replace(/{username}/g, recipient.username ? recipient.username : "");
  transformedMessage = transformedMessage.replace(/{url}/g, recipient.url ? recipient.url : "");
  transformedMessage = transformedMessage.replace(/{bio}/g, recipient.bio ? recipient.bio : "");
  transformedMessage = transformedMessage.replace(/{followers}/g, recipient.followers ? recipient.followers : "");
  transformedMessage = transformedMessage.replace(/{following}/g, recipient.following ? recipient.following : "");
  
  return transformedMessage;
}

function isMemoryError(error) {
  const errorMessage = error.message || '';
  return errorMessage.includes('Target.createTarget timed out') || 
    errorMessage.includes('out of memory') || 
    errorMessage.includes('TimeoutError') ||
    errorMessage.includes('Browser closed') ||
    errorMessage.includes('Protocol error') || 
    errorMessage.includes('Increase the \'protocolTimeout\'') ||
    errorMessage.includes('Waiting for selector') ||
    errorMessage.includes('Waiting failed:');
}

module.exports = {
  messageTransformFunction,
  isMemoryError
}; 