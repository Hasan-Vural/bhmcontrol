import logging
import colorlog

def get_logger(name):
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = colorlog.StreamHandler()
        handler.setFormatter(colorlog.ColoredFormatter(
            '%(log_color)s%(asctime)s - [%(name)s] - %(levelname)s - %(message)s',
            log_colors={
                'DEBUG': 'cyan',
                'INFO': 'green',
                'WARNING': 'yellow',
                'ERROR': 'red',
                'CRITICAL': 'red,bg_white',
            }
        ))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO) # Gerekirse DEBUG yapabiliriz
    return logger